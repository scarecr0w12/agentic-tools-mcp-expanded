import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileStorage } from '../../../../src/features/task-management/storage/file-storage.js';
import { Task } from '../../../../src/features/task-management/models/task.js';
import { Project } from '../../../../src/features/task-management/models/project.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper functions to create test objects
function createTestProject(overrides?: Partial<Project>): Project {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: 'Test Project',
    description: 'Test Description',
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createTestTask(projectId: string, overrides?: Partial<Task>): Task {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: 'Test Task',
    details: 'Test Details',
    projectId,
    completed: false,
    createdAt: now,
    updatedAt: now,
    priority: 5,
    status: 'pending',
    tags: [],
    ...overrides
  };
}

describe('FileStorage', () => {
  const testDirectory = path.join(__dirname, '../../../test-data');
  let storage: FileStorage;

  beforeEach(async () => {
    await fs.mkdir(testDirectory, { recursive: true });
    storage = new FileStorage(testDirectory);
    await storage.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDirectory, { recursive: true, force: true });
  });

  describe('Project Operations', () => {
    it('should create a project', async () => {
      const project = createTestProject();
      const created = await storage.createProject(project);

      expect(created.id).toBe(project.id);
      expect(created.name).toBe(project.name);
    });

    it('should get all projects', async () => {
      const project1 = createTestProject({ name: 'Project 1' });
      const project2 = createTestProject({ name: 'Project 2' });
      
      await storage.createProject(project1);
      await storage.createProject(project2);

      const projects = await storage.getProjects();
      expect(projects).toHaveLength(2);
    });

    it('should get project by id', async () => {
      const project = createTestProject();
      await storage.createProject(project);

      const retrieved = await storage.getProject(project.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(project.id);
    });

    it('should update project', async () => {
      const project = createTestProject();
      await storage.createProject(project);

      const updated = await storage.updateProject(project.id, { name: 'Updated Name' });
      expect(updated?.name).toBe('Updated Name');
    });

    it('should delete project', async () => {
      const project = createTestProject();
      await storage.createProject(project);

      await storage.deleteProject(project.id);
      const retrieved = await storage.getProject(project.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Task Operations', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = createTestProject();
      await storage.createProject(project);
      projectId = project.id;
    });

    it('should create a task', async () => {
      const task = createTestTask(projectId);
      const created = await storage.createTask(task);

      expect(created.id).toBe(task.id);
      expect(created.name).toBe(task.name);
      expect(created.projectId).toBe(projectId);
      expect(created.level).toBe(0);
    });

    it('should create nested task with parentId', async () => {
      const parent = createTestTask(projectId, { name: 'Parent' });
      await storage.createTask(parent);

      const child = createTestTask(projectId, { name: 'Child', parentId: parent.id });
      const created = await storage.createTask(child);

      expect(created.parentId).toBe(parent.id);
      expect(created.level).toBe(1);
    });

    it('should support unlimited nesting depth', async () => {
      const level0 = createTestTask(projectId, { name: 'Level 0' });
      await storage.createTask(level0);

      const level1 = createTestTask(projectId, { name: 'Level 1', parentId: level0.id });
      await storage.createTask(level1);

      const level2 = createTestTask(projectId, { name: 'Level 2', parentId: level1.id });
      await storage.createTask(level2);

      const level3 = createTestTask(projectId, { name: 'Level 3', parentId: level2.id });
      const created = await storage.createTask(level3);

      expect(created.level).toBe(3);
    });

    it('should get tasks by project', async () => {
      await storage.createTask(createTestTask(projectId, { name: 'Task 1' }));
      await storage.createTask(createTestTask(projectId, { name: 'Task 2' }));

      const tasks = await storage.getTasks(projectId);
      expect(tasks).toHaveLength(2);
    });

    it('should get task by id', async () => {
      const task = createTestTask(projectId);
      await storage.createTask(task);

      const retrieved = await storage.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(task.id);
    });

    it('should update task', async () => {
      const task = createTestTask(projectId);
      await storage.createTask(task);

      const updated = await storage.updateTask(task.id, { 
        name: 'Updated Task',
        completed: true 
      });

      expect(updated?.name).toBe('Updated Task');
      expect(updated?.completed).toBe(true);
    });

    it('should delete task', async () => {
      const task = createTestTask(projectId);
      await storage.createTask(task);

      await storage.deleteTask(task.id);
      const retrieved = await storage.getTask(task.id);
      expect(retrieved).toBeNull();
    });

    it('should get task children', async () => {
      const parent = createTestTask(projectId, { name: 'Parent' });
      await storage.createTask(parent);

      await storage.createTask(createTestTask(projectId, { name: 'Child 1', parentId: parent.id }));
      await storage.createTask(createTestTask(projectId, { name: 'Child 2', parentId: parent.id }));

      const children = await storage.getTaskChildren(parent.id);
      expect(children).toHaveLength(2);
    });

    it('should get task ancestors', async () => {
      const level0 = createTestTask(projectId, { name: 'L0' });
      await storage.createTask(level0);

      const level1 = createTestTask(projectId, { name: 'L1', parentId: level0.id });
      await storage.createTask(level1);

      const level2 = createTestTask(projectId, { name: 'L2', parentId: level1.id });
      await storage.createTask(level2);

      const ancestors = await storage.getTaskAncestors(level2.id);
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0].name).toBe('L0');
      expect(ancestors[1].name).toBe('L1');
    });
  });

  describe('Data Migration', () => {
    it('should detect when migration is not needed', async () => {
      const status = await storage.getMigrationStatus();
      expect(status.needsMigration).toBe(false);
      expect(status.subtaskCount).toBe(0);
    });

    it('should detect when migration is needed', async () => {
      // Create a project and task
      const project = createTestProject();
      await storage.createProject(project);
      const task = createTestTask(project.id);
      await storage.createTask(task);

      // Manually add legacy subtask to file
      const dataPath = path.join(testDirectory, '.agentic-tools-mcp', 'tasks', 'tasks.json');
      const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
      data.subtasks = [{
        id: randomUUID(),
        name: 'Legacy Subtask',
        details: 'Legacy',
        taskId: task.id,
        projectId: project.id,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];
      await fs.writeFile(dataPath, JSON.stringify(data, null, 2));

      // Reload storage
      const newStorage = new FileStorage(testDirectory);
      await newStorage.initialize();

      const status = await newStorage.getMigrationStatus();
      expect(status.needsMigration).toBe(false); // Should be migrated automatically on init
    });

    it('should migrate legacy subtasks to tasks', async () => {
      const project = createTestProject();
      await storage.createProject(project);
      const task = createTestTask(project.id, { name: 'Parent Task' });
      await storage.createTask(task);

      // Add legacy subtask
      const dataPath = path.join(testDirectory, '.agentic-tools-mcp', 'tasks', 'tasks.json');
      const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
      const legacyId = randomUUID();
      data.subtasks = [{
        id: legacyId,
        name: 'Legacy Subtask',
        details: 'Should be migrated',
        taskId: task.id,
        projectId: project.id,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];
      await fs.writeFile(dataPath, JSON.stringify(data, null, 2));

      // Reload and auto-migrate
      const newStorage = new FileStorage(testDirectory);
      await newStorage.initialize();

      // Verify migration
      const migratedTask = await newStorage.getTask(legacyId);
      expect(migratedTask).not.toBeNull();
      expect(migratedTask?.name).toBe('Legacy Subtask');
      expect(migratedTask?.parentId).toBe(task.id);
      expect(migratedTask?.level).toBe(1);
    });
  });

  describe('Task Hierarchy', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = createTestProject();
      await storage.createProject(project);
      projectId = project.id;
    });

    it('should get hierarchical task structure', async () => {
      const parent = createTestTask(projectId, { name: 'Parent' });
      await storage.createTask(parent);

      await storage.createTask(createTestTask(projectId, { name: 'Child 1', parentId: parent.id }));
      await storage.createTask(createTestTask(projectId, { name: 'Child 2', parentId: parent.id }));

      // Get all tasks and filter for top-level (those without parentId)
      const allTasks = await storage.getTasks(projectId);
      const topLevel = allTasks.filter(t => !t.parentId);
      expect(topLevel).toHaveLength(1); // One top-level task
      
      // Verify children exist
      const children = await storage.getTaskChildren(parent.id);
      expect(children).toHaveLength(2); // Two children
    });

    it('should move task to different parent', async () => {
      const parent1 = createTestTask(projectId, { name: 'Parent 1' });
      await storage.createTask(parent1);

      const parent2 = createTestTask(projectId, { name: 'Parent 2' });
      await storage.createTask(parent2);

      const child = createTestTask(projectId, { name: 'Child', parentId: parent1.id });
      await storage.createTask(child);

      const moved = await storage.moveTask(child.id, parent2.id);
      expect(moved?.parentId).toBe(parent2.id);
    });
   });
});