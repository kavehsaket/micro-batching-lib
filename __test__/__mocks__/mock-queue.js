const { QueueInterface } = require("../../index");

class MockQueue extends QueueInterface {
  constructor() {
    super();
    this.jobs = [];
  }

  add(job) {
    this.jobs.push(job);
  }

  process(handler) {
    setInterval(() => {
      if (this.jobs.length > 0) {
        const job = this.jobs.shift();
        handler(job);
      }
    }, 100);
  }
}

module.exports = MockQueue;
