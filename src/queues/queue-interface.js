/**
 * @interface QueueInterface
 */
class QueueInterface {
  /**
   * @param {Job} job
   * @returns {Promise}
   */
  add(job) {
    throw new Error('Method "add" not implemented');
  }

  process(handler) {
    throw new Error('Method "process" not implemented');
  }

  stop() {
    throw new Error('Method "stop" not implemented');
  }
}

module.exports = QueueInterface;
