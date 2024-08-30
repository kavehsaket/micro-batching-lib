const EventEmitter = require("events");

class MicroBatching extends EventEmitter {
  /**
   *
   * @param {QueueInterface} queue
   * @param {BatchProcessorInterface} batchProcessor
   * @param {number} batchSize
   * @param {number} batchInterval
   * @param {object} config
   */
  constructor(queue, batchProcessor, batchSize, batchInterval, config = {}) {
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
    this.batchSize = batchSize;
    this.batchInterval = batchInterval;
    this.maxRetries = config.maxRetries || 3; // Default to 3 retries if not provided
    this.retryCondition = config.retryCondition || this.defaultRetryCondition;
    this.jobsQueue = [];
    this.timer = null;
    this.isProcessing = false; // Tracks whether a batch is being processed
  }

  // Default retry condition if the user does not provide one
  defaultRetryCondition(result, job) {
    return result.status === "failed" && job.retries < this.maxRetries;
  }

  start() {
    this.timer = setInterval(() => {
      this.processBatch();
    }, this.batchInterval);

    // Start processing jobs from the queue
    this.queue.process(this.processBatch.bind(this));

    // Emit a 'start' event
    this.emit("start");
  }

  submitJob(job) {
    return new Promise((resolve) => {
      job.retries = 0; // Initialize retry counter
      this.jobsQueue.push({ job, resolve });

      // Emit a 'jobSubmitted' event
      this.emit("jobSubmitted", job);

      // Process the batch immediately if this is a single job or the queue meets the batch size
      if (this.jobsQueue.length >= this.batchSize) {
        this.processBatch();
      }
    });
  }

  async processBatch() {
    if (this.jobsQueue.length > 0 && !this.isProcessing) {
      this.isProcessing = true;
      const jobsToProcess = this.jobsQueue.splice(0, this.batchSize);
      const jobObjects = jobsToProcess.map((entry) => entry.job);

      try {
        const results = await this.batchProcessor.processBatch(jobObjects);

        results.forEach((result, index) => {
          const job = jobsToProcess[index].job;
          if (this.retryCondition(result, job)) {
            // Retry the job
            job.retries += 1;
            this.jobsQueue.push(jobsToProcess[index]); // Re-add job to the queue
            this.emit("jobRetry", job);
          } else if (result.status === "failed") {
            // Exhausted retries, mark as failed
            jobsToProcess[index].resolve(result);
            this.emit("jobFailed", job);
          } else {
            // Job succeeded
            jobsToProcess[index].resolve(result);
          }
        });

        // Emit a 'batchProcessed' event
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
      }
    }
  }

  shutdown() {
    clearInterval(this.timer);

    return new Promise((resolve) => {
      const checkForCompletion = () => {
        if (this.jobsQueue.length === 0 && !this.isProcessing) {
          // Emit a 'shutdownComplete' event
          this.emit("shutdownComplete");
          resolve();
        } else {
          setImmediate(checkForCompletion);
        }
      };

      // Emit a 'shutdown' event
      this.emit("shutdown");

      // Process any remaining jobs before shutdown
      this.processBatch().then(checkForCompletion);
    });
  }
}

module.exports = MicroBatching;
