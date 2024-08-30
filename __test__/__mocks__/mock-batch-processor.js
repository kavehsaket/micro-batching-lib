const { BatchProcessorInterface } = require("../../index");

class MockBatchProcessor extends BatchProcessorInterface {
  constructor(options = {}) {
    super();
    this.failFirstTime = options.failFirstTime || false;
    this.failAlways = options.failAlways || false;
    this.failRandomly = options.failRandomly || false;
    this.failureRate = options.failureRate || 0.5;
    this.delayProcessing = options.delayProcessing || false;
    this.processedJobs = new Set();
    this.retriedJobs = new Set();
  }

  processBatch(jobs) {
    return new Promise((resolve) => {
      const processJobs = () => {
        const results = jobs.map((job) => {
          if (this.failAlways) {
            return {
              jobId: job.id,
              status: "failed",
              message: "Failed after all retries",
            };
          }
          if (this.failFirstTime && !this.processedJobs.has(job.id)) {
            this.processedJobs.add(job.id);
            return {
              jobId: job.id,
              status: "failed",
              message: "Failed first time",
            };
          }
          if (this.failRandomly && Math.random() < this.failureRate) {
            return {
              jobId: job.id,
              status: "failed",
              message: "Random failure occurred",
            };
          }

          const isRetry = this.processedJobs.has(job.id);
          this.processedJobs.add(job.id);

          if (isRetry) {
            this.retriedJobs.add(job.id);
          }

          return {
            jobId: job.id,
            status: "success",
            message: this.retriedJobs.has(job.id)
              ? "Processed successfully after retry"
              : "Processed successfully",
          };
        });
        resolve(results);
      };

      if (this.delayProcessing) {
        setTimeout(processJobs, 1000);
      } else {
        processJobs();
      }
    });
  }
}

module.exports = MockBatchProcessor;
