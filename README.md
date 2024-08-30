# Micro-Batching Library

This library provides a queue-agnostic micro-batching system for Node.js. It allows you to integrate your own queue and batch processor implementations by adhering to simple interfaces. The library also integrates Node.js's `EventEmitter` to allow for event-driven handling of job processing stages, with customisable retry logic.

## Features

- **Queue-Agnostic:** Bring your own queue system that follows the provided interface.
- **Batch-Processor-Agnostic:** Bring your own batch processor that follows the provided interface.
- **Configurable:** Configure the batch size, interval, and retry logic as needed.
- **Event-Driven:** Leverages `EventEmitter` to provide hooks into the job processing lifecycle.
- **Graceful Shutdown:** Ensures all jobs are processed before shutting down.
- **Extensible:** Easily extend the system to support different queues and batch processing logic.
- **Lightweight:** Minimal dependencies and easy to integrate into existing projects.
- **JavaScript:** Written in plain JavaScript, so it can be used in any Node.js project.
- **Tested:** Includes comprehensive tests to ensure reliability.
- **Intelligent Batch Processing:** Processes single jobs immediately and respects batch intervals for multiple jobs.

### Batch Processing Behaviour

- If a single job is submitted, it will be processed immediately without waiting for the batch interval.
- If multiple jobs are submitted, they will be processed in batches according to the specified `batchSize` and `batchInterval`.
- The library will always try to fill a batch up to `batchSize`, but will also process smaller batches if the `batchInterval` has elapsed since the last batch was processed.

## Job Retry Behaviour

When a job fails, the library follows these steps:

1. It checks the retry condition (customisable, default checks if the job failed and hasn't exceeded max retries).
2. If the retry condition is met:
   - The job's retry count is incremented.
   - A backoff delay is calculated using the backoff strategy.
   - The job is pushed back into the queue with a next retry time.
   - A "jobRetry" event is emitted with the job and backoff delay.
3. If the retry condition is not met:
   - The job is resolved with a failed status.
   - A "jobFailed" event is emitted.
4. Retried jobs are processed in the next available batch after their next retry time has passed.
5. This process continues until the job succeeds or the retry condition is no longer met.

The library implements an exponential backoff strategy with jitter for retries:

- The base delay is set to 1 second.
- For each retry, the delay increases exponentially up to a maximum of 30 seconds.
- A random jitter of up to 10% is added to the delay to prevent thundering herd problems.
- This handling of retries helps to distribute the load on the system over time, preventing a large number of jobs from retrying simultaneously.

Both the retry condition and backoff strategy can be customised in the configuration:

## Installation

Install the library using pnpm:

```bash
pnpm add micro-batching-lib
```

## Usage

Here's a simple example of how to use the Micro-Batching Library:

```javascript
const {
  MicroBatching,
  Job,
  QueueInterface,
  BatchProcessorInterface,
} = require("micro-batching-lib");
const { Queue } = require("./path/to/your/queue/implementation");
const {
  BatchProcessor,
} = require("./path/to/your/batch/processor/implementation");

const queue = new Queue();
const batchProcessor = new BatchProcessor();

const microBatching = new MicroBatching(queue, batchProcessor, {
  batchSize: 10, // The maximum number of jobs to process in a single batch.
  batchInterval: 1000, // The time interval (in milliseconds) between batch processing attempts.
  maxRetries: 3, // The maximum number of times a job will be retried if it fails.
  retryCondition: (result, job) =>
    result.status === "failed" && job.retries < 3, // A function that determines whether a job should be retried.
  backoffStrategy: (retries) => Math.min(30, Math.pow(2, retries) * 1000), // A function that determines the delay before retrying a failed job.
});

microBatching.on("job_added", (job) => {
  console.log(`Job ${job.id} added to the queue`);
});

microBatching.start();

const job = new Job(1, "Data for job 1");
microBatching.submitJob(job);

microBatching.shutdown();
```

## Queue and Batch Processor Interfaces

The library provides two interfaces that need to be implemented:

1. **QueueInterface**

```javascript
class QueueInterface {
  add(job) {
    throw new Error("Method 'add' not implemented");
  }

  process(callback) {
    throw new Error("Method 'process' not implemented");
  }

  stop() {
    throw new Error("Method 'stop' not implemented");
  }
}
```

2. **BatchProcessorInterface**

```javascript
class BatchProcessorInterface {
  processBatch(jobs) {
    throw new Error("Method 'processBatch' not implemented");
  }
}
```

## Configuration Object

The `MicroBatching` class accepts a configuration object as its third parameter. This object allows you to customize the behavior of the micro-batching system. Here are the available configuration options:

1. **batchSize** (default: 10)

   - Type: `number`
   - Description: The maximum number of jobs to process in a single batch.

2. **batchInterval** (default: 1000)

   - Type: `number`
   - Description: The time interval (in milliseconds) between batch processing attempts.

3. **maxRetries** (default: 3)

   - Type: `number`
   - Description: The maximum number of times a job will be retried if it fails.

4. **retryCondition** (default: internal function)

   - Type: `function(result, job)`
   - Description: A function that determines whether a job should be retried. It receives the processing result and the job object as parameters and should return a boolean.

5. **backoffStrategy** (default: exponential backoff with jitter)
   - Type: `function(retryCount)`
   - Description: A function that determines the delay before retrying a failed job. It receives the current retry count as a parameter and should return the delay in milliseconds.

Example configuration:

```javascript
const microBatching = new MicroBatching(queue, batchProcessor, {
  batchSize: 10,
  batchInterval: 1000,
  maxRetries: 3,
  retryCondition: (result, job) =>
    result.status === "failed" && job.retries < 3,
  backoffStrategy: (retries) => Math.min(30, Math.pow(2, retries) * 1000),
});
```

## License

This project is licensed under the MIT License.

## Questions

If you have any questions, please open an issue on GitHub.
