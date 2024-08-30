class QueueInterface {
  add(job) {
    throw new Error('Method "add" not implemented');
  }

  process(handler) {
    throw new Error('Method "process" not implemented');
  }
}

module.exports = QueueInterface;
