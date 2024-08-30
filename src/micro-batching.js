const EventEmitter = require("events");

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
  }

  defaultRetryCondition(result, job) {
    return result.status === "failed" && job.retries < this.config.maxRetries;
  }

  start() {
    this.timer = setInterval(() => {
      this.processBatch();
    }, this.config.batchInterval);

    this.queue.process(this.processBatch.bind(this));
    this.emit("start");
  }

  submitJob(job) {
    return new Promise((resolve) => {
      job.retries = 0;
      this.jobsQueue.push({ job, resolve });
      this.emit("jobSubmitted", job);

      if (this.jobsQueue.length >= this.config.batchSize) {
        this.processBatch();
      }
    });
  }

  async processBatch() {
    if (this.jobsQueue.length > 0 && !this.isProcessing) {
      this.isProcessing = true;
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
      }
    }
  }

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
