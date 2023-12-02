import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { parse } from "url";
import busboy from "busboy";
import { readdir, stat } from "fs/promises";
import prettyBytes from "pretty-bytes";

async function defaultRoutes(req, res) {
  res.statusCode = 200;
  return res.end("Hello World");
}

function canExecute(lastMessagesent, messageTimeDelay) {
  return Date.now() - lastMessagesent >= messageTimeDelay;
}

function handleByBytes(filename, io, socketId) {
  let lastMessagesent = Date.now();
  let timeDelay = 200;

  // generator function for the chunk handling
  async function* handleData(source) {
    let processedData = 0;

    for await (const chunk of source) {
      yield chunk;
      processedData += chunk.length;
      if (canExecute(lastMessagesent, timeDelay)) {
        continue;
      }

      lastMessagesent = Date.now();
      io.to(socketId).emit("onuploadEvent", {
        processedData,
        filename,
      });
    }
  }
  return handleData.bind(this);
}

async function onFile(file, filename, io, socketId) {
  const saveTo = `${process.cwd()}/downloads/${filename}`;
  await pipeline(
    file,
    handleByBytes(filename, io, socketId),
    createWriteStream(saveTo),
  );
}

const onFinish = (response) => () => {
  response.writeHead(200);
  const data = JSON.stringify({ result: "Files uploaded with success! " });
  response.end(data);
};

async function post(req, res, io) {
  const { headers } = req;
  const {
    query: { socketId },
  } = parse(req.url, true);
  const busboyInstance = busboy({ headers });

  busboyInstance.on("file", (name, file, info) => {
    const { filename } = info;
    onFile(file, filename, io, socketId);
  });

  busboyInstance.on("finish", onFinish(res));
  req.pipe(busboyInstance);
}

const get = async (req, res) => {
  const downloadFolder = process.cwd() + "/downloads";
  const currentFiles = await readdir(downloadFolder);
  const statuses = await Promise.all(
    currentFiles.map((file) => stat(`${downloadFolder}/${file}`)),
  );
  const filesStatuses = [];
  for (const fileIndex in currentFiles) {
    const { birthtime, size } = statuses[fileIndex];
    filesStatuses.push({
      size: prettyBytes(size),
      file: currentFiles[fileIndex],
      lastModified: birthtime,
      owner: process.env.USER || "admin",
    });
  }
  res.writeHead(200);
  const data = JSON.stringify({ data: filesStatuses });
  res.end(data);
};

const options = async (request, response) => {
  response.writeHead(204);
  response.end();
};

class Handler {
  constructor() {
    this.io = {};
  }

  setSocketInstanace(io) {
    this.io = io;
  }

  handler(request, response) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE",
    );
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Credentials", true);
    switch (request.method.toLowerCase()) {
      case "options":
        return options(request, response);
      case "post":
        return post(request, response, this.io);
      case "get":
        return get(request, response);
      default:
        return defaultRoutes(request, response);
    }
  }
}

export default Handler;
