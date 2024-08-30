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
      maxRetries: 3,
      retryCondition: (result, job) => {
        return result.status === "failed" && job.retries < 3;
      },
    });

    microBatching.start();

    const result = await microBatching.submitJob(new Job(1, "Data for job 1"));
    expect(result.status).toBe("success");
    expect(result.message).toBe("Processed successfully after retry");

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
      maxRetries: 3,
      retryCondition: (result, job) => {
        return result.status === "failed" && job.retries < 3;
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
    expect(typeof shutdownPromise.then).toBe("function"); //  To return a promise

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

    // Check if the custom config values are set correctly based on the provided values
    expect(microBatching.config.batchSize).toBe(customConfig.batchSize);
    expect(microBatching.config.batchInterval).toBe(customConfig.batchInterval);
    expect(microBatching.config.maxRetries).toBe(customConfig.maxRetries);
    expect(microBatching.config.retryCondition).toBe(
      customConfig.retryCondition
    );

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
});
