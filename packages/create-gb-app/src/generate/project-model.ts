import type { FileMap } from '../types/generate';

/** What emit modules contribute; `renderProject` turns it into files. */
export type ProjectModel = {
  /** Root `.gitignore` lines; order matters for negations like `!.env.example`. */
  ignoreLines: string[];
};

export function createProjectModel(): ProjectModel {
  return { ignoreLines: [] };
}

export function renderProject(project: ProjectModel): FileMap {
  const files: FileMap = {};
  if (project.ignoreLines.length > 0)
    files['.gitignore'] = [...new Set(project.ignoreLines)].join('\n') + '\n';
  return files;
}
