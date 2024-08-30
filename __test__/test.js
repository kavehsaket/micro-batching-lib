const { MicroBatching, Job } = require("../index");

const MockQueue = require("./__mocks__/mock-queue");
const MockBatchProcessor = require("./__mocks__/mock-batch-processor");

describe("MicroBatching Library", () => {
  it("should process jobs successfully without retries", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: false });

    const microBatching = new MicroBatching(queue, batchProcessor, 2, 500);
    microBatching.start();

    const result = await microBatching.submitJob(new Job(1, "Data for job 1"));
    expect(result.status).toBe("success");
    expect(result.message).toBe("Processed successfully");

    await microBatching.shutdown();
  });

  it("should retry a failed job up to the specified retry limit", async () => {
    const queue = new MockQueue();
    const batchProcessor = new MockBatchProcessor({ failFirstTime: true });

    const microBatching = new MicroBatching(queue, batchProcessor, 2, 500, {
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

    const microBatching = new MicroBatching(queue, batchProcessor, 2, 500, {
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

    const microBatching = new MicroBatching(queue, batchProcessor, 2, 500);
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

    const microBatching = new MicroBatching(queue, batchProcessor, 1, 500);
    microBatching.start();

    const result = await microBatching.submitJob(new Job(1, "Single Job Data"));
    expect(result.status).toBe("success");
    expect(result.message).toBe("Processed successfully");

    await microBatching.shutdown();
  });
});
