/**
 * @class Job
 */
class Job {
  /**
   * @param {number} id
   * @param {any} data
   */
  constructor(id, data) {
    if (typeof id !== "number" && typeof id !== "string") {
      throw new Error("Job ID must be a number or a string");
    }
    this.id = id;
    this.data = data;
  }
}

module.exports = Job;
