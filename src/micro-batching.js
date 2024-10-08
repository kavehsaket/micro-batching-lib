const EventEmitter = require("events");
const Job = require("./job");

/**
 * @class MicroBatching
 * @extends EventEmitter
 */
class MicroBatching extends EventEmitter {
  /**
   * @param {QueueInterface} queue
   * @param {BatchProcessorInterface} batchProcessor
   * @param {object} config
   */
  constructor(queue, batchProcessor, config = {}) {
    super();

    if (
      typeof queue.add !== "function" ||
      typeof queue.process !== "function"
    ) {
      throw new Error(
        "Provided queue does not implement the required interface"
      );
    }

    if (typeof batchProcessor.processBatch !== "function") {
      throw new Error(
        "Provided batch processor does not implement the required interface"
      );
    }

    this.queue = queue;
    this.batchProcessor = batchProcessor;
    this.config = {
      batchSize: config.batchSize || 10,
      batchInterval: config.batchInterval || 1000,
      maxRetries: config.maxRetries || 3,
      retryCondition: config.retryCondition || this.defaultRetryCondition,
      backoffStrategy: config.backoffStrategy || this.defaultBackoffStrategy,
      logger: config.logger || null, // Default to null if no logger is provided
      externalHandler: config.externalHandler || null, // External handler for failed jobs
    };
    this.jobsQueue = [];
    this.timer = null;
    this.isProcessing = false;
    this.lastProcessTime = Date.now();
    this.isShuttingDown = false;
  }

  /**
   * @param {number} retryCount
   * @returns {number}
   * @description Default backoff strategy: exponential backoff with jitter.
   * This helps to avoid thundering herd problem.
   */
  defaultBackoffStrategy(retryCount) {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    const jitter = Math.random() * delay * 0.1; // 10% jitter
    return delay + jitter;
  }

  /**
   * @param {object} result
   * @param {Job} job
   * @returns {boolean}
   * @description Default retry condition: retry if the job failed and hasn't exceeded max retries.
   */
  defaultRetryCondition(result, job) {
    return result.status === "failed" && job.retries < this.config.maxRetries;
  }

  /**
   * @returns {void}
   */
  start() {
    if (this.config.logger) {
      this.config.logger.info("MicroBatching started");
    }
    this.timer = setInterval(() => {
      this.processBatch();
    }, this.config.batchInterval);

    this.queue.process(this.processBatch.bind(this));
    this.emit("start");
  }

  /**
   * @param {Job} job
   * @returns {Promise}
   */
  submitJob(job) {
    if (!(job instanceof Job)) {
      return Promise.reject(new Error("Job must be an instance of Job"));
    }
    return new Promise((resolve) => {
      job.retries = 0;
      this.jobsQueue.push({ job, resolve });
      this.emit("jobSubmitted", job);
      if (this.config.logger) {
        this.config.logger.info(`Job submitted: ${job.id}`);
      }

      if (this.jobsQueue.length === 1) {
        // Process immediately if it's the only job
        this.processBatch();
      } else if (this.jobsQueue.length >= this.config.batchSize) {
        // Process if we've reached the batch size
        this.processBatch();
      }
    });
  }

  /**
   * @returns {Promise}
   */
  async processBatch() {
    if (this.isShuttingDown) return; // Don't process new batches during shutdown

    const now = Date.now();
    const timeSinceLastProcess = now - this.lastProcessTime;

    if (
      this.jobsQueue.length > 0 &&
      !this.isProcessing &&
      (timeSinceLastProcess >= this.config.batchInterval ||
        this.jobsQueue.length === 1)
    ) {
      this.isProcessing = true;
      this.lastProcessTime = now;

      // Filter out jobs that should not be processed yet (retry condition not met)
      const jobsToProcess = this.jobsQueue
        .filter(
          (entry) => !entry.job.nextRetryTime || entry.job.nextRetryTime <= now
        )
        .splice(0, this.config.batchSize);
      const jobObjects = jobsToProcess.map((entry) => entry.job);

      try {
        const results = await this.batchProcessor.processBatch(jobObjects);

        results.forEach((result, index) => {
          const job = jobsToProcess[index].job;
          if (this.config.retryCondition(result, job)) {
            const backoffDelay = this.config.backoffStrategy(job.retries);
            job.retries += 1;
            job.nextRetryTime = now + backoffDelay;
            this.jobsQueue.push(jobsToProcess[index]);
            this.emit("jobRetry", job, backoffDelay);
            if (this.config.logger) {
              this.config.logger.warn(
                `Job retry: ${job.id}, retries: ${job.retries}, backoff: ${backoffDelay}`
              );
            }
          } else {
            // Remove the job from jobsQueue if it's not being retried
            const jobIndex = this.jobsQueue.findIndex(
              (entry) => entry.job.id === job.id
            );
            if (jobIndex !== -1) {
              this.jobsQueue.splice(jobIndex, 1);
            }

            if (result.status === "failed") {
              jobsToProcess[index].resolve(result);
              this.emit("jobFailed", job);
              if (this.config.logger) {
                this.config.logger.error(`Job failed: ${job.id}`);
              }
              if (this.config.externalHandler) {
                this.config.externalHandler(job);
              }
            } else {
              jobsToProcess[index].resolve(result);
              this.emit("jobCompleted", job);
              if (this.config.logger) {
                this.config.logger.info(`Job completed: ${job.id}`);
              }
            }
          }
        });

        this.emit("batchProcessed", jobObjects, results);
        if (this.config.logger) {
          this.config.logger.info(`Batch processed: ${jobObjects.length} jobs`);
        }
      } catch (err) {
        jobsToProcess.forEach((entry) =>
          entry.resolve({
            jobId: entry.job.id,
            status: "failed",
            message: err.message,
          })
        );
        if (this.config.logger) {
          this.config.logger.error(`Batch processing error: ${err.message}`);
        }
      } finally {
        this.isProcessing = false;

        // Check if there are more jobs to process
        if (this.jobsQueue.length > 0) {
          const nextJob = this.jobsQueue[0].job;
          const delay = nextJob.nextRetryTime
            ? Math.max(0, nextJob.nextRetryTime - now)
            : 0;
          setTimeout(
            () => this.processBatch(),
            Math.max(delay, this.config.batchInterval)
          );
        } else {
          // Stop the interval if the queue is empty
          clearInterval(this.timer);
          this.timer = null;
        }
      }
    }
  }

  /**
   * @returns {Promise}
   */
  async shutdown() {
    clearInterval(this.timer);
    this.isShuttingDown = true;
    this.queue.stop();
    if (this.config.logger) {
      this.config.logger.info("MicroBatching shutting down");
    }
    // Process remaining jobs
    while (this.jobsQueue.length > 0 || this.isProcessing) {
      if (!this.isProcessing) {
        await this.processBatch();
      }
      await new Promise((resolve) => setTimeout(resolve, 100)); // Short delay to prevent tight loop
    }
    this.emit("shutdownComplete");
    if (this.config.logger) {
      this.config.logger.info("MicroBatching shutdown complete");
    }
    return Promise.resolve();
  }
}

module.exports = MicroBatching;
