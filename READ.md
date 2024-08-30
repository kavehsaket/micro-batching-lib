# Micro-Batching Library

This library provides a queue-agnostic micro-batching system for Node.js. It allows you to integrate your own queue and batch processor implementations by adhering to simple interfaces. The library also integrates Node.js's `EventEmitter` to allow for event-driven handling of job processing stages, with customizable retry logic.

## Features

- **Queue-Agnostic:** Users can plug in any queue system that follows the provided interface.
- **Batch Processing:** Process jobs in batches based on configurable size and time intervals.
- **Event-Driven:** Leverages `EventEmitter` to provide hooks into the job processing lifecycle.
- **Custom Retry Logic:** Define custom conditions for when jobs should be retried upon failure.
- **Graceful Shutdown:** Ensures all jobs are processed before shutting down.
- **Extensible:** Easily extend the system to support different queues and batch processing logic.

## Installation

Install the library using npm:

```bash
pnpm install micro-batching-lib
```

## Usage

1. Implement your own queue by adhering to the `QueueInterface` provided by this Library

```const { QueueInterface } = require('micro-batching-lib');

class MyCustomQueue extends QueueInterface {
    add(job) {
        // Add job to your custom queue
    }

    process(handler) {
        // Process jobs using the handler
    }
}
```

2. Implement your own batch processor by adhering to the BatchProcessorInterface provided by this library

```const { BatchProcessorInterface } = require('micro-batching-lib');

class MyCustomBatchProcessor extends BatchProcessorInterface {
    processBatch(jobs) {
        // Process the array of jobs
        jobs.forEach(job => {
            console.log(`Processing job ${job.id} with data: ${job.data}`);
        });

        // Example: Return a promise resolving to job results
        return Promise.resolve(jobs.map(job => ({
            jobId: job.id,
            status: 'success',
            message: 'Processed successfully'
        })));
    }
}
```

3. Create an instance of the MicroBatcher class and configure it:

```

```
