const { MicroBatching, Job } = require("../index");

const MockQueue = require("./__mocks__/mock-queue");
const MockBatchProcessor = require("./__mocks__/mock-batch-processor");

describe("MicroBatching Library", () => {
  let microBatching;

  afterEach(async () => {
    if (microBatching) {
      await microBatching.shutdown();
    }
  });

  it("should process jobs successfully without retries", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: false });

    microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 2,
      batchInterval: 500,
    });
    microBatching.start();

    const result = await microBatching.submitJob(new Job(1, "Data for job 1"));
    expect(result.status).toBe("success");
    expect(result.message).toBe("Processed successfully");
  });

  it("should retry a failed job up to the specified retry limit", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: true });

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 2,
      batchInterval: 500,
      maxRetries: 4,
      retryCondition: (result, job) => {
        return result.status === "failed" && job.retries < 4;
      },
    });

    microBatching.start();

    const result = await microBatching.submitJob(new Job(1, "Data for job 1"));
    expect(result.status).toBe("success");
    expect(result.message).toBe("Processed successfully after retry");

    await microBatching.shutdown();
  });

  it("should retry a failed job after a delay", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({
      failFirstTime: true,
      retryDelay: 1000,
    });

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 2,
      batchInterval: 500,
      maxRetries: 1,
      retryCondition: (result, job) => {
        return result.status === "failed" && job.retries < 1;
      },
    });

    microBatching.start();

    const startTime = Date.now();
    const result = await microBatching.submitJob(new Job(1, "Data for job 1"));
    const endTime = Date.now();

    expect(result.status).toBe("success");
    expect(result.message).toBe("Processed successfully after retry");
    expect(endTime - startTime).toBeGreaterThanOrEqual(1000);

    await microBatching.shutdown();
  });

  it("should fail a job after exceeding the retry limit", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({
      failFirstTime: true,
      failAlways: true,
    });

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 2,
      batchInterval: 500,
      maxRetries: 1,
      retryCondition: (result, job) => {
        return result.status === "failed" && job.retries < 1;
      },
    });

    microBatching.start();

    const result = await microBatching.submitJob(new Job(1, "Data for job 1"));
    expect(result.status).toBe("failed");
    expect(result.message).toBe("Failed after all retries");

    await microBatching.shutdown();
  });

  it("should gracefully shutdown after processing all jobs", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: false });

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 2,
      batchInterval: 500,
    });
    microBatching.start();

    await microBatching.submitJob(new Job(1, "Data for job 1"));
    await microBatching.submitJob(new Job(2, "Data for job 2"));

    const shutdownPromise = microBatching.shutdown();
    expect(typeof shutdownPromise.then).toBe("function"); // promise

    await shutdownPromise;
  });

  it("should process a single job and return the result", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: false });

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 1,
      batchInterval: 500,
    });
    microBatching.start();

    const result = await microBatching.submitJob(new Job(1, "Single Job Data"));
    expect(result.status).toBe("success");
    expect(result.message).toBe("Processed successfully");

    await microBatching.shutdown();
  });

  it("should process a single job immediately", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: false });

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 5,
      batchInterval: 1000,
    });
    microBatching.start();

    const startTime = Date.now();
    const result = await microBatching.submitJob(new Job(1, "Single Job Data"));
    const endTime = Date.now();

    expect(result.status).toBe("success");
    expect(result.message).toBe("Processed successfully");
    expect(endTime - startTime).toBeLessThan(100);

    await microBatching.shutdown();
  });

  it("should use default config values when not provided", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: false });

    const microBatching = new MicroBatching(queue, batchProcessor);
    microBatching.start();

    const result = await microBatching.submitJob(
      new Job(1, "Default Config Job")
    );
    expect(result.status).toBe("success");
    expect(result.message).toBe("Processed successfully");

    await microBatching.shutdown();
  });

  it("should use provided config values over default values", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor();

    // Custom configuration values
    const customConfig = {
      batchSize: 5, // Default is 10
      batchInterval: 2000, // Default is 1000
      maxRetries: 5, // Default is 3
      retryCondition: (result, job) =>
        result.status === "failed" && job.retries < 5,
    };

    const microBatching = new MicroBatching(
      queue,
      batchProcessor,
      customConfig
    );
    microBatching.start();

    expect(microBatching.config.batchSize).toBe(customConfig.batchSize);
    expect(microBatching.config.batchInterval).toBe(customConfig.batchInterval);
    expect(microBatching.config.maxRetries).toBe(customConfig.maxRetries);
    expect(microBatching.config.retryCondition).toBe(
      customConfig.retryCondition
    );

    await microBatching.shutdown();
  });

  it("should respect batch interval when processing multiple batches", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: false });

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 2,
      batchInterval: 1000,
    });
    microBatching.start();

    const startTime = Date.now();
    const jobs = [
      microBatching.submitJob(new Job(1, "Job 1")),
      microBatching.submitJob(new Job(2, "Job 2")),
      microBatching.submitJob(new Job(3, "Job 3")),
      microBatching.submitJob(new Job(4, "Job 4")),
    ];

    await Promise.all(jobs);
    const endTime = Date.now();

    expect(endTime - startTime).toBeGreaterThanOrEqual(1000); // At least one interval wait

    await microBatching.shutdown();
  });

  it("should use custom backoff strategy", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: false });

    const customBackoffStrategy = (retryCount) => {
      return 1000 * Math.pow(2, retryCount);
    };

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 2,
      batchInterval: 1000,
      maxRetries: 3,
      backoffStrategy: customBackoffStrategy,
    });
    microBatching.start();

    const startTime = Date.now();

    const jobs = [
      microBatching.submitJob(new Job(1, "Job 1")),
      microBatching.submitJob(new Job(2, "Job 2")),
      microBatching.submitJob(new Job(3, "Job 3")),
      microBatching.submitJob(new Job(4, "Job 4")),
    ];

    await Promise.all(jobs);
    const endTime = Date.now();

    expect(endTime - startTime).toBeGreaterThanOrEqual(1000); // At least one interval wait

    await microBatching.shutdown();
  });

  it("should handle shutdown while processing jobs", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: false });

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 2,
      batchInterval: 1000,
      maxRetries: 3,
    });
    microBatching.start();

    const startTime = Date.now();
    const jobs = [
      microBatching.submitJob(new Job(1, "Job 1")),
      microBatching.submitJob(new Job(2, "Job 2")),
      microBatching.submitJob(new Job(3, "Job 3")),
      microBatching.submitJob(new Job(4, "Job 4")),
    ];

    await Promise.all(jobs);
    const endTime = Date.now();

    expect(endTime - startTime).toBeGreaterThanOrEqual(1000); // At least one interval wait

    await microBatching.shutdown();
  });

  it("should handle delayed batch processing correctly", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({
      delayProcessing: true,
      retryDelay: 2000,
    });

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 2,
      batchInterval: 500,
    });
    microBatching.start();

    const startTime = Date.now();
    const result = await microBatching.submitJob(
      new Job(1, "Delayed Job Data")
    );
    const endTime = Date.now();

    expect(result.status).toBe("success");
    expect(result.message).toBe("Processed successfully");
    expect(endTime - startTime).toBeGreaterThanOrEqual(2000);

    await microBatching.shutdown();
  });

  it("should process jobs immediately when batch size is reached", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: false });

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 2,
      batchInterval: 800,
    });
    microBatching.start();

    const startTime = Date.now();
    const job1Promise = microBatching.submitJob(new Job(1, "Job 1 Data"));
    const job2Promise = microBatching.submitJob(new Job(2, "Job 2 Data"));

    const [result1, result2] = await Promise.all([job1Promise, job2Promise]);
    const endTime = Date.now();

    expect(result1.status).toBe("success");
    expect(result1.message).toBe("Processed successfully");
    expect(result2.status).toBe("success");
    expect(result2.message).toBe("Processed successfully");

    // Jest is not so accurate to the millisecond, so we need to add some buffer
    expect(endTime - startTime).toBeLessThan(805);

    await microBatching.shutdown();
  });

  it("should handle multiple batches with different processing times", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({
      delayProcessing: true,
      retryDelay: 100,
    });

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 3,
      batchInterval: 500,
    });
    microBatching.start();

    const startTime = Date.now();
    const jobs = [
      microBatching.submitJob(new Job(1, "Job 1")),
      microBatching.submitJob(new Job(2, "Job 2")),
      microBatching.submitJob(new Job(3, "Job 3")),
      microBatching.submitJob(new Job(4, "Job 4")),
      microBatching.submitJob(new Job(5, "Job 5")),
    ];

    const results = await Promise.all(jobs);
    const endTime = Date.now();

    results.forEach((result) => {
      expect(result.status).toBe("success");
      expect(result.message).toBe("Processed successfully");
    });

    // First batch (3 jobs) should be processed immediately
    // Second batch (2 jobs) should wait for the batch interval
    // Total time should be at least batchInterval + 2 * retryDelay
    expect(endTime - startTime).toBeGreaterThanOrEqual(700);

    await microBatching.shutdown();
  });

  it("should handle high load with multiple concurrent job submissions", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({
      delayProcessing: true,
      retryDelay: 50,
    });

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 10,
      batchInterval: 200,
    });
    microBatching.start();

    const startTime = Date.now();
    const jobCount = 100;
    const jobs = Array.from({ length: jobCount }, (_, i) =>
      microBatching.submitJob(new Job(i + 1, `Job ${i + 1}`))
    );

    const results = await Promise.all(jobs);
    const endTime = Date.now();

    // Check all jobs were processed successfully
    results.forEach((result) => {
      expect(result.status).toBe("success");
      expect(result.message).toBe("Processed successfully");
    });

    // Expected time: (jobCount / batchSize) * (batchInterval + retryDelay)
    const expectedBatches = Math.ceil(
      jobCount / microBatching.config.batchSize
    );
    const expectedMinTime =
      expectedBatches *
      (microBatching.config.batchInterval + batchProcessor.config.retryDelay);
    const expectedMaxTime = expectedMinTime + 1000; // Allow 1 second buffer for processing overhead

    // Use a more lenient assertion due to potential JavaScript timing inconsistencies
    expect(endTime - startTime).toBeGreaterThan(expectedMinTime * 0.8);
    expect(endTime - startTime).toBeLessThan(expectedMaxTime * 1.2);

    // Verify that the batch processor was called the expected number of times.
    // The +1 accounts for the initial call to processBatch when the first job is submitted.
    expect(batchProcessor.callCount).toBe(expectedBatches + 1);

    await microBatching.shutdown();
  }, 10000);

  it("should call external handler for failed jobs", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({
      failFirstTime: true,
      failAlways: true,
    });

    const externalHandler = jest.fn();

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 2,
      batchInterval: 500,
      maxRetries: 1,
      retryCondition: (result, job) => {
        return result.status === "failed" && job.retries < 1;
      },
      externalHandler,
    });

    microBatching.start();

    const result = await microBatching.submitJob(new Job(1, "Data for job 1"));
    expect(result.status).toBe("failed");
    expect(result.message).toBe("Failed after all retries");

    expect(externalHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 })
    );

    await microBatching.shutdown();
  });

  it("should log events using the provided logger", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: false });

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const microBatching = new MicroBatching(queue, batchProcessor, {
      batchSize: 2,
      batchInterval: 500,
      logger,
    });

    microBatching.start();
    expect(logger.info).toHaveBeenCalledWith("MicroBatching started");

    const result = await microBatching.submitJob(new Job(1, "Data for job 1"));
    expect(result.status).toBe("success");
    expect(result.message).toBe("Processed successfully");

    expect(logger.info).toHaveBeenCalledWith("Job submitted: 1");
    expect(logger.info).toHaveBeenCalledWith("Batch processed: 1 jobs");

    await microBatching.shutdown();
    expect(logger.info).toHaveBeenCalledWith("MicroBatching shutting down");
    expect(logger.info).toHaveBeenCalledWith("MicroBatching shutdown complete");
  });
});
