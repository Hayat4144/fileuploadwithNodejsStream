import { io } from "socket.io-client";
import moment from "moment/moment";

let fileupload = document.getElementById("fileupload");
let toast = document.getElementById("toast-default");
let notification = document.getElementById("notification");
let tbody = document.getElementById("tbody");
let API_URl = "http://localhost:8000/";
let socketId = "";
let totalFileSize = 0;
let socket = io(API_URl);
let uploadedFile = new Map();

function timeAgo(timestamp) {
  return moment(timestamp).calendar();
}

socket.on("connect", () => {
  socketId = socket.id;
});

const updateCurrentFiles = (files) => {
  const template = (item) => `
        <tr>
            <td class="border-b border-slate-200 p-2">${item.file}</td>
            <td class="border-b border-slate-200 p-2">${item.owner}</td>
            <td  class="border-b border-slate-100 p-2">${timeAgo(
              item.lastModified,
            )}</td>
            <td  class="border-b border-slate-200 p-2">${item.size}</td>
        </tr>
        `;

  tbody.innerHTML = files.map(template).join("");
};

const getCurrentFile = async () => {
  const response = await fetch(`${API_URl}`);
  return response.json();
};

window.onload = async () => {
  const { data } = await getCurrentFile();
  updateCurrentFiles(data);
};

const requestHandler = async (fileSize, FormData) => {
  const response = await fetch(
    `${API_URl}?socketId=${socketId}&fileSize=${fileSize}`,
    {
      method: "POST",
      body: FormData,
    },
  );
  return response.json();
};

socket.on("onuploadEvent", ({ processedData, filename }) => {
  if (uploadedFile.has(filename)) {
    const file = uploadedFile.get(filename);
    file.processedData = processedData;
    // Calculate progress for the specific file
    const fileProgress = Math.ceil((file.processedData / file.size) * 100);

    // Calculate overall progress for all files
    toast.style.display = "flex";
    const overallProgress = calculateOverallProgress();
    notification.innerText = `uploading in ${overallProgress}%`;
  }
});

function calculateOverallProgress() {
  const totalProcessed = [...uploadedFile.values()].reduce(
    (total, file) => total + file.processedData,
    0,
  );
  const totalSize = [...uploadedFile.values()].reduce(
    (total, file) => total + file.size,
    0,
  );
  return Math.ceil((totalProcessed / totalSize) * 100);
}

fileupload.addEventListener("change", async () => {
  uploadedFile.clear();
  const files = Array.from(fileupload.files);
  const formdata = new FormData();
  totalFileSize = files.reduce((a, b) => a + b.size, 0);

  files.forEach((file) => {
    formdata.append("file", file);
    uploadedFile.set(file.name, { size: file.size, processedData: 0 });
  });

  const { result } = await requestHandler(totalFileSize, formdata);
  const { data } = await getCurrentFile();
  updateCurrentFiles(data);

  notification.innerText = result;
  setTimeout(() => {
    toast.style.display = "none";
    notification.innerText = "";
  }, 3000);
});
