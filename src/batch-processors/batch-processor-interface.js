/**
 * @interface BatchProcessorInterface
 */
class BatchProcessorInterface {
  /**
   * @param {Job[]} jobs
   * @returns {Promise}
   */
  processBatch(jobs) {
    throw new Error('Method "processBatch" not implemented');
  }
}

module.exports = BatchProcessorInterface;
