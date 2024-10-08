# Micro-Batching Library

This library provides a queue-agnostic micro-batching system for Node.js. It allows you to integrate your own queue and batch processor implementations by adhering to simple interfaces. The library also integrates Node.js's `EventEmitter` to allow for event-driven handling of job processing stages, with customisable retry logic.

## Features

- **Queue-Agnostic:** Bring your own queue system that follows the provided interface.
- **Batch-Processor-Agnostic:** Bring your own batch processor that follows the provided interface.
- **Configurable:** Configure the batch size, interval, retry logic, and logging as needed.
- **Event-Driven:** Leverages `EventEmitter` to provide hooks into the job processing lifecycle.
- **Graceful Shutdown:** Ensures all jobs are processed before shutting down.
- **Extensible:** Easily extend the system to support different queues and batch processing logic.
- **Lightweight:** Zero dependencies and written in plain JavaScript, so it can be used in any Node.js project.
- **Tested:** The library is tested with a basic in-memory queue and batch processor.
- **Intelligent Batch Processing:** Processes single jobs immediately and respects batch intervals for multiple jobs.
- **Logging:** Integrate with any logging system to log important events and states.
- **External Handler:** Process jobs outside of the batching system for exceptional cases.

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
- The externalHandler is a fallback mechanism to process jobs outside of the batching system. This is useful for exceptional cases where a job cannot be processed within the batching system.

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
  externalHandler: (job) => {
    console.log(
      `Job ${job.id} is being processed outside of the batching system`
    );
  },
  logger: {
    info: (message) => console.log(`INFO: ${message}`),
    warn: (message) => console.log(`WARN: ${message}`),
    error: (message) => console.log(`ERROR: ${message}`),
});

microBatching.on("job_added", (job) => {
  console.log(`Job ${job.id} added to the queue`);
});

microBatching.start();

const job = new Job(1, "Data for job 1");
microBatching.submitJob(job);

microBatching.shutdown();
```

## Job Object

The library expects a job object to be submitted with an id and data. The id must be a number or a string but should be unique within the system. The data can be any type. The library does not place any restrictions on the type of data that can be submitted. You can extend the Job class to add any additional data you need to handle in your `BatchProcessor`.

```javascript
class Job {
  constructor(id, data) {
    this.id = id; // The id must be a number or a string.
    this.data = data; // The data can be any type.
  }
}
```

Example extended job class:

```javascript
class ExampleJob extends Job {
  constructor(id, data) {
    super(id, data);
    this.priority = priority;
  }
}
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

6. **logger** (default: null)

   - Type: `object`
   - Description: An object that implements the logging interface. It should have `info`, `error`, and `warn` methods.

7. **externalHandler** (default: null)
   - Type: `function(job)`
   - Description: A function that handles jobs outside of the batching system. It receives the job object as a parameter and should return a promise that resolves when the job is processed.

Example configuration:

```javascript
const microBatching = new MicroBatching(queue, batchProcessor, {
  batchSize: 10,
  batchInterval: 1000,
  maxRetries: 3,
  retryCondition: (result, job) =>
    result.status === "failed" && job.retries < 3,
  backoffStrategy: (retries) => Math.min(30, Math.pow(2, retries) * 1000),
  externalHandler: (job) => {
    console.log(
      `Job ${job.id} is being processed outside of the batching system`
    );
  },
  logger: {
    info: (message) => console.log(`INFO: ${message}`),
    warn: (message) => console.log(`WARN: ${message}`),
    error: (message) => console.log(`ERROR: ${message}`),
  },
});
```

## License

This project is licensed under the MIT License.

## Questions

If you have any questions, please open an issue on GitHub.

```

```
