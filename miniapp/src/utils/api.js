import Taro from "@tarojs/taro";

const API_BASE = "http://127.0.0.1:8787";

export async function request(path, method = "GET", data = undefined) {
  try {
    const response = await Taro.request({
      url: `${API_BASE}${path}`,
      method,
      data,
      header: { "content-type": "application/json" }
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(response.data?.message || "请求失败");
    }

    return response.data;
  } catch (error) {
    throw new Error(error.message || "网络连接失败，请确认后端服务已启动");
  }
}

export function getHistory() {
  return request("/api/history");
}

export function saveHistory(type, payload) {
  return request("/api/history", "POST", { type, payload });
}

export function deleteHistory(id) {
  return request(`/api/history/${id}`, "DELETE");
}

export function getContentPackage() {
  return request("/api/content-package");
}

export function generateTextbook(data) {
  return request("/api/generate/textbook", "POST", data);
}

export function generateWrongQuestion(data) {
  return request("/api/generate/wrong-question", "POST", data);
}

export function generatePaper(data) {
  return request("/api/generate/paper", "POST", data);
}

export function exportFile(format, payload) {
  return request("/api/export", "POST", { format, payload });
}

export function createAssignment(data) {
  return request("/api/assignments", "POST", data);
}

export function getAssignments() {
  return request("/api/assignments");
}

export function getArchivedAssignments() {
  return request("/api/assignments?status=archived");
}

export function getAssignment(id) {
  return request(`/api/assignments/${id}`);
}

export function archiveAssignment(id) {
  return request(`/api/assignments/${id}/archive`, "POST", {});
}

export function restoreAssignment(id) {
  return request(`/api/assignments/${id}/restore`, "POST", {});
}

export function getAssignmentByCode(code) {
  return request(`/api/assignments/code/${encodeURIComponent(code)}`);
}

export function submitAssignment(id, data) {
  return request(`/api/assignments/${id}/submissions`, "POST", data);
}

export function uploadAssignmentImages(id, data) {
  return request(`/api/assignments/${id}/upload`, "POST", data);
}

export function getAssignmentSubmissions(id) {
  return request(`/api/assignments/${id}/submissions`);
}

export function getSubmission(id) {
  return request(`/api/submissions/${id}`);
}

export function markSubmissionViewed(id) {
  return request(`/api/submissions/${id}/viewed`, "POST", {});
}

export function exportAssignment(id, format, type) {
  return request(`/api/assignments/${id}/export?format=${format}&type=${type}`);
}
