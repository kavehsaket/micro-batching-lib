const EventEmitter = require("events");

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
    };
    this.jobsQueue = [];
    this.timer = null;
    this.isProcessing = false;
    this.lastProcessTime = Date.now();
  }

  /**
   * @param {object} result
   * @param {Job} job
   * @returns {boolean}
   */
  defaultRetryCondition(result, job) {
    return result.status === "failed" && job.retries < this.config.maxRetries;
  }

  /**
   * @returns {void}
   */
  start() {
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
    return new Promise((resolve) => {
      job.retries = 0;
      this.jobsQueue.push({ job, resolve });
      this.emit("jobSubmitted", job);

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

      const jobsToProcess = this.jobsQueue.splice(0, this.config.batchSize);
      const jobObjects = jobsToProcess.map((entry) => entry.job);

      try {
        const results = await this.batchProcessor.processBatch(jobObjects);

        results.forEach((result, index) => {
          const job = jobsToProcess[index].job;
          if (this.config.retryCondition(result, job)) {
            job.retries += 1;
            this.jobsQueue.push(jobsToProcess[index]);
            this.emit("jobRetry", job);
          } else if (result.status === "failed") {
            jobsToProcess[index].resolve(result);
            this.emit("jobFailed", job);
          } else {
            jobsToProcess[index].resolve(result);
          }
        });

        this.emit("batchProcessed", jobObjects, results);
      } catch (err) {
        console.error("Error processing batch:", err);
        jobsToProcess.forEach((entry) =>
          entry.resolve({
            jobId: entry.job.id,
            status: "failed",
            message: err.message,
          })
        );
      } finally {
        this.isProcessing = false;

        // Check if there are more jobs to process
        if (this.jobsQueue.length > 0) {
          setTimeout(() => this.processBatch(), this.config.batchInterval);
        }
      }
    }
  }

  /**
   * @returns {Promise}
   */
  shutdown() {
    clearInterval(this.timer);

    return new Promise((resolve) => {
      const checkForCompletion = () => {
        if (this.jobsQueue.length === 0 && !this.isProcessing) {
          this.emit("shutdownComplete");
          resolve();
        } else {
          setImmediate(checkForCompletion);
        }
      };

      this.emit("shutdown");
      this.processBatch().then(checkForCompletion);
    });
  }
}

module.exports = MicroBatching;
