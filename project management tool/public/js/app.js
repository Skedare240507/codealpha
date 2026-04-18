let currentUser = null;
let projects = [];
let currentProject = null;
let tasks = [];
const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    checkUser();
    
    // Socket listeners
    socket.on('taskCreated', (task) => {
        if (currentProject && task.project_id === currentProject.id) fetchTasks(currentProject.id);
    });
    socket.on('taskUpdated', (data) => {
        if (currentProject) fetchTasks(currentProject.id);
    });
    socket.on('commentAdded', (data) => {
        const detailModal = document.getElementById('task-detail-modal');
        const activeTaskId = document.getElementById('detail-task-id').innerText;
        if (detailModal.style.display === 'flex' && activeTaskId == data.task_id) {
            fetchComments(data.task_id);
        }
    });
});

async function checkUser() {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
        currentUser = await res.json();
        document.getElementById('user-nav').innerHTML = `
            <span style="margin-right: 1rem; color: var(--text-muted)">Hi, ${currentUser.username}</span>
            <button class="btn" style="background: rgba(239, 68, 68, 0.2); color: #ef4444;" onclick="logout()">Logout</button>
        `;
        fetchProjects();
    }
}

async function logout() {
    // Basic logout by clearing token (server doesn't have a specific logout route but clearing cookie works)
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    location.reload();
}

// Projects
async function fetchProjects() {
    const res = await fetch('/api/projects');
    projects = await res.json();
    const list = document.getElementById('project-list');
    list.innerHTML = projects.map(p => `
        <div class="project-item" id="project-${p.id}" onclick="selectProject(${p.id})">${p.name}</div>
    `).join('');
}

function selectProject(id) {
    currentProject = projects.find(p => p.id === id);
    document.querySelectorAll('.project-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`project-${id}`).classList.add('active');
    
    document.getElementById('welcome-message').style.display = 'none';
    document.getElementById('board-header').style.display = 'block';
    document.getElementById('board').style.display = 'flex';
    document.getElementById('current-project-name').innerText = currentProject.name;
    
    socket.emit('joinProject', id);
    fetchTasks(id);
}

async function createProject() {
    const name = document.getElementById('project-name-input').value;
    const description = document.getElementById('project-desc-input').value;
    const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
    });
    if (res.ok) {
        closeProjectModal();
        fetchProjects();
    }
}

// Tasks
async function fetchTasks(projectId) {
    const res = await fetch(`/api/projects/${projectId}/tasks`);
    tasks = await res.json();
    renderBoard();
}

function renderBoard() {
    const cols = { todo: [], doing: [], done: [] };
    tasks.forEach(t => cols[t.status].push(t));
    
    ['todo', 'doing', 'done'].forEach(status => {
        const listEl = document.getElementById(`${status}-tasks`);
        listEl.innerHTML = cols[status].map(t => `
            <div class="task-card" onclick="openTaskDetail(${t.id})">
                <div class="task-title">${t.title}</div>
                <div class="task-desc">${t.description || 'No description'}</div>
            </div>
        `).join('');
    });
}

async function createTask() {
    const title = document.getElementById('task-title-input').value;
    const description = document.getElementById('task-desc-input').value;
    
    await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: currentProject.id, title, description })
    });
    closeTaskModal();
}

async function updateTaskStatus() {
    const taskId = document.getElementById('detail-task-id').innerText;
    const status = document.getElementById('detail-status').value;
    await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, project_id: currentProject.id })
    });
}

// Comments
async function fetchComments(taskId) {
    const res = await fetch(`/api/tasks/${taskId}/comments`);
    const comments = await res.json();
    const list = document.getElementById('comment-list');
    list.innerHTML = comments.map(c => `
        <div style="margin-bottom: 0.75rem; font-size: 0.85rem;">
            <strong style="color: var(--primary)">${c.username}</strong>: ${c.content}
        </div>
    `).join('');
}

async function addComment() {
    const taskId = document.getElementById('detail-task-id').innerText;
    const content = document.getElementById('comment-input').value;
    if (!content) return;
    
    await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, content, project_id: currentProject.id })
    });
    document.getElementById('comment-input').value = '';
}

// Modal Controls
function openProjectModal() { document.getElementById('project-modal').style.display = 'flex'; }
function closeProjectModal() { document.getElementById('project-modal').style.display = 'none'; }
function openTaskModal() { document.getElementById('task-modal').style.display = 'flex'; }
function closeTaskModal() { document.getElementById('task-modal').style.display = 'none'; }

function openTaskDetail(id) {
    const task = tasks.find(t => t.id === id);
    document.getElementById('detail-task-id').innerText = id;
    document.getElementById('detail-title').innerText = task.title;
    document.getElementById('detail-desc').innerText = task.description || 'No description';
    document.getElementById('detail-status').value = task.status;
    document.getElementById('task-detail-modal').style.display = 'flex';
    fetchComments(id);
}

function closeTaskDetailModal() { document.getElementById('task-detail-modal').style.display = 'none'; }
