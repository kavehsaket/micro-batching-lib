/**
 * @module MicroBatching
 * @description A library for processing jobs in micro-batches with retry logic.
 * @version 1.0.0
 * @author 'Kaveh Saket'
 * @license MIT
 * @example
 * const { MicroBatching, Job, QueueInterface, BatchProcessorInterface } = require('micro-batching');
 *
 * const queue = new QueueInterface();
 * const batchProcessor = new BatchProcessorInterface();
 * const microBatching = new MicroBatching(queue, batchProcessor);
 * microBatching.start();
 * microBatching.submitJob(new Job(1, 'Data for job 1'));
 * microBatching.shutdown();
 */

const MicroBatching = require("./src/micro-batching");
const Job = require("./src/job");
const QueueInterface = require("./src/queues/queue-interface");
const BatchProcessorInterface = require("./src/batch-processors/batch-processor-interface");

module.exports = {
  MicroBatching,
  QueueInterface,
  Job,
  BatchProcessorInterface,
};
