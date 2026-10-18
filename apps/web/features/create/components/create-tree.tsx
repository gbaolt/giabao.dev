'use client';

import { getIconExtension } from '@/components/doc/mdx/extensions/get-icon';
import {
  TreeExpander,
  TreeIcon,
  TreeLabel,
  TreeNode,
  TreeNodeContent,
  TreeNodeTrigger,
  TreeProvider,
  TreeView,
} from '@/components/kibo-ui/tree';

import { languageFromPath } from '../lib/language-from-path';
import {
  collectFolderIds,
  type TreeNode as FolderNode,
  treeNodeId,
} from '../lib/tree-from-paths';

type CreateTreeProps = {
  tree: FolderNode;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
};

export function CreateTree({
  tree,
  selectedPath,
  onSelectPath,
}: CreateTreeProps) {
  const expandedIds = collectFolderIds(tree);
  const selectedIds = selectedPath ? [selectedPath] : [];

  return (
    <TreeProvider
      key={treeNodeId(tree)}
      defaultExpandedIds={expandedIds}
      selectedIds={selectedIds}
      onSelectionChange={(ids) => {
        const next = ids[0];
        if (!next || next === selectedPath) {
          return;
        }
        if (isFilePath(tree, next)) {
          onSelectPath(next);
        }
      }}
    >
      <TreeView aria-label="Project files">
        <FolderTreeNode
          node={tree}
          level={0}
          isLast
          onSelectPath={onSelectPath}
        />
      </TreeView>
    </TreeProvider>
  );
}

function FolderTreeNode({
  node,
  level,
  isLast,
  onSelectPath,
}: {
  node: FolderNode;
  level: number;
  isLast: boolean;
  onSelectPath: (path: string) => void;
}) {
  const children = node.children ?? [];
  const isFolder = node.kind === 'folder';
  const hasChildren = children.length > 0;
  const nodeId = treeNodeId(node);

  return (
    <TreeNode
      aria-label={node.name}
      hasChildren={hasChildren}
      isLast={isLast}
      level={level}
      nodeId={nodeId}
    >
      <TreeNodeTrigger
        onClick={() => {
          if (node.kind === 'file') {
            onSelectPath(node.path);
          }
        }}
      >
        <TreeExpander hasChildren={hasChildren} />
        <TreeIcon
          hasChildren={isFolder}
          icon={
            node.kind === 'file'
              ? getIconExtension(languageFromPath(node.path))
              : undefined
          }
        />
        <TreeLabel className="font-mono">{node.name}</TreeLabel>
      </TreeNodeTrigger>
      {hasChildren && (
        <TreeNodeContent hasChildren>
          {children.map((child, index) => (
            <FolderTreeNode
              key={treeNodeId(child)}
              node={child}
              level={level + 1}
              isLast={index === children.length - 1}
              onSelectPath={onSelectPath}
            />
          ))}
        </TreeNodeContent>
      )}
    </TreeNode>
  );
}

function isFilePath(node: FolderNode, path: string): boolean {
  if (node.kind === 'file') {
    return node.path === path;
  }
  return (node.children ?? []).some((child) => isFilePath(child, path));
}
