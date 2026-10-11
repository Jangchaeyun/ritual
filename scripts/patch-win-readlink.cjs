const fs = require("node:fs");

if (process.platform === "win32") {

function markNotLink(error) {
  if (!error || error.code !== "EISDIR") return error;
  const notLink = new Error(error.message);
  notLink.code = "EINVAL";
  notLink.syscall = error.syscall;
  notLink.path = error.path;
  return notLink;
}

const readlinkSync = fs.readlinkSync;
fs.readlinkSync = function (path, options) {
  try {
    return readlinkSync.call(this, path, options);
  } catch (error) {
    throw markNotLink(error);
  }
};

const readlink = fs.readlink;
fs.readlink = function (path, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  return readlink.call(this, path, options, (error, link) => {
    callback(error ? markNotLink(error) : null, link);
  });
};

const readlinkPromise = fs.promises.readlink.bind(fs.promises);
  fs.promises.readlink = async function (path, options) {
    try {
      return await readlinkPromise(path, options);
    } catch (error) {
      throw markNotLink(error);
    }
  };
}
