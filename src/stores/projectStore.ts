import { create } from 'zustand';
import { fetchJson } from '@/lib/clientApi';
import { Project } from '@/lib/types';

interface ProjectStore {
  projects: Project[];
  archivedProjects: Project[];
  isLoading: boolean;

  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  archivedProjects: [],
  isLoading: false,

  loadProjects: async () => {
    set({ isLoading: true });

    try {
      const [projects, archivedProjects] = await Promise.all([
        fetchJson<Project[]>('/api/projects?scope=active'),
        fetchJson<Project[]>('/api/projects?scope=archived'),
      ]);

      set({
        projects,
        archivedProjects,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load projects:', error);
      set({ isLoading: false });
    }
  },

  createProject: async (name, description) => {
    const project = await fetchJson<Project>('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });

    set((state) => ({
      projects: [project, ...state.projects],
    }));

    return project;
  },

  deleteProject: async (id) => {
    await fetchJson<{ ok: boolean }>(`/api/projects/${id}`, {
      method: 'DELETE',
    });

    await get().loadProjects();
  },

  restoreProject: async (id) => {
    const project = await fetchJson<Project>(`/api/projects/${id}/restore`, {
      method: 'POST',
    });

    await get().loadProjects();
    return project;
  },

  updateProject: async (id, updates) => {
    const updated = await fetchJson<Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? updated : project
      ),
      archivedProjects: state.archivedProjects.map((project) =>
        project.id === id ? updated : project
      ),
    }));
  },
}));
