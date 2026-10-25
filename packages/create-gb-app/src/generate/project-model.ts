import type { FileMap } from '../types/generate';

/** README sections an emit module may contribute; the README places them. */
export type ReadmeSectionId = 'configuration-notes' | 'hosted-database';

/** What emit modules contribute; `renderProject` turns it into files. */
export type ProjectModel = {
  /** Root `.gitignore` lines; order matters for negations like `!.env.example`. */
  ignoreLines: string[];
  readmeSections: Partial<Record<ReadmeSectionId, string>>;
};

export function createProjectModel(): ProjectModel {
  return { ignoreLines: [], readmeSections: {} };
}

export function addReadmeSection(
  project: ProjectModel,
  id: ReadmeSectionId,
  body: string
): void {
  if (project.readmeSections[id] !== undefined)
    throw new Error(`README section ${id} already has a writer`);
  project.readmeSections[id] = body;
}

export function renderProject(project: ProjectModel): FileMap {
  const files: FileMap = {};
  if (project.ignoreLines.length > 0)
    files['.gitignore'] = [...new Set(project.ignoreLines)].join('\n') + '\n';
  return files;
}
