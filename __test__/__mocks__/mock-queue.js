const { QueueInterface } = require("../../index");

class MockQueue extends QueueInterface {
  constructor() {
    super();
    this.jobs = [];
    this.intervalId = null;
  }

  add(job) {
    this.jobs.push(job);
  }

  process(handler) {
    this.intervalId = setInterval(() => {
      if (this.jobs.length > 0) {
        const job = this.jobs.shift();
        handler(job);
      }
    }, 100);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

module.exports = MockQueue;
