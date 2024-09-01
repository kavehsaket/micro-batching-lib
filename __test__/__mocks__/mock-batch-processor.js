const { BatchProcessorInterface } = require("../../index");

class MockBatchProcessor extends BatchProcessorInterface {
  constructor(options = {}) {
    super();
    this.config = {
      failFirstTime: options.failFirstTime || false,
      failAlways: options.failAlways || false,
      failRandomly: options.failRandomly || false,
      failureRate: options.failureRate || 0.5,
      delayProcessing: options.delayProcessing || false,
      retryDelay: options.retryDelay || 0,
      failOnSpecificJobs: options.failOnSpecificJobs || new Set(),
      maxRetriesBeforeSuccess: options.maxRetriesBeforeSuccess || 0,
    };

    this.processedJobs = new Map(); // track retries for each job
    this.retriedJobs = new Set();
    this.callCount = 0;
  }

  processBatch(jobs) {
    this.callCount++;
    return new Promise((resolve) => {
      const processJobs = () => {
        const results = jobs.map((job) => {
          const retryCount = this.processedJobs.get(job.id) || 0;

          // Determine if this job should fail based on conditions
          const shouldFail =
            this.config.failAlways ||
            (this.config.failFirstTime && retryCount === 0) ||
            (this.config.failRandomly &&
              Math.random() < this.config.failureRate) ||
            (this.config.failOnSpecificJobs.has(job.id) &&
              retryCount < this.config.maxRetriesBeforeSuccess);

          if (shouldFail) {
            this.processedJobs.set(job.id, retryCount + 1);
            return {
              jobId: job.id,
              status: "failed",
              message: "Failed after all retries",
            };
          }

          this.processedJobs.set(job.id, retryCount + 1);

          if (retryCount > 0) {
            this.retriedJobs.add(job.id);
          }

          return {
            jobId: job.id,
            status: "success",
            message:
              retryCount > 0
                ? "Processed successfully after retry"
                : "Processed successfully",
          };
        });

        resolve(results);
      };

      if (this.config.delayProcessing) {
        setTimeout(processJobs, this.config.retryDelay);
      } else {
        processJobs();
      }
    });
  }
}

module.exports = MockBatchProcessor;
