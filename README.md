# Micro-Batching Library

This library provides a queue-agnostic micro-batching system for Node.js. It allows you to integrate your own queue and batch processor implementations by adhering to simple interfaces. The library also integrates Node.js's `EventEmitter` to allow for event-driven handling of job processing stages, with customizable retry logic.

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

## Installation

Install the library using pnpm:
pnpm add micro-batching-lib

## Usage

Here's a simple example of how to use the Micro-Batching Library:

```javascript
const { MicroBatching, Job } = require("micro-batching-lib");
const { Queue } = require("./path/to/your/queue/implementation");
const {
  BatchProcessor,
} = require("./path/to/your/batch/processor/implementation");

const queue = new Queue();
const batchProcessor = new BatchProcessor();

const microBatching = new MicroBatching(queue, batchProcessor, {
  batchSize: 10,
  batchInterval: 1000,
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
```

2. **BatchProcessorInterface**

```javascript
class BatchProcessorInterface {
  processBatch(jobs) {
    throw new Error("Method 'processBatch' not implemented");
  }
```

## License

This project is licensed under the MIT License.

## Questions

If you have any questions, please open an issue on GitHub.
