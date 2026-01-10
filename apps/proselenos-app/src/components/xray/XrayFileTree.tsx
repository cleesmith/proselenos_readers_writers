import React, { useState, useCallback } from 'react';
import { MdFolder, MdFolderOpen, MdInsertDriveFile, MdChevronRight, MdExpandMore } from 'react-icons/md';
import { XrayTreeNode, formatFileSize } from '@/services/xrayService';

interface XrayFileTreeProps {
  tree: XrayTreeNode;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

interface TreeNodeProps {
  node: XrayTreeNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  defaultExpanded?: boolean;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth,
  selectedPath,
  onSelectFile,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || depth === 0);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isDirectory) {
      setIsExpanded((prev) => !prev);
    }
  }, [node.isDirectory]);

  const handleSelect = useCallback(() => {
    if (!node.isDirectory) {
      onSelectFile(node.path);
    } else {
      setIsExpanded((prev) => !prev);
    }
  }, [node.isDirectory, node.path, onSelectFile]);

  const isSelected = selectedPath === node.path;
  const hasChildren = node.children && node.children.length > 0;

  // Skip rendering the root node itself, just render its children
  if (depth === 0 && node.name === '/') {
    return (
      <div className="xray-tree">
        {node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={0}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
            defaultExpanded={true}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="xray-tree-node">
      <div
        className={`flex items-center py-1 px-2 cursor-pointer hover:bg-base-300 rounded transition-colors ${
          isSelected ? 'bg-primary/20 text-primary' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect();
          }
        }}
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={node.isDirectory ? isExpanded : undefined}
      >
        {/* Expand/collapse icon for directories */}
        {node.isDirectory ? (
          <span
            className="mr-1 flex-shrink-0 text-base-content/60"
            onClick={handleToggle}
          >
            {isExpanded ? (
              <MdExpandMore size={16} />
            ) : (
              <MdChevronRight size={16} />
            )}
          </span>
        ) : (
          <span className="mr-1 w-4 flex-shrink-0" />
        )}

        {/* Folder/file icon */}
        <span className="mr-2 flex-shrink-0">
          {node.isDirectory ? (
            isExpanded ? (
              <MdFolderOpen size={16} className="text-warning" />
            ) : (
              <MdFolder size={16} className="text-warning" />
            )
          ) : (
            <MdInsertDriveFile size={16} className="text-base-content/70" />
          )}
        </span>

        {/* File/folder name */}
        <span className="truncate text-sm flex-grow">{node.name}</span>

        {/* File size for files */}
        {!node.isDirectory && node.size > 0 && (
          <span className="ml-2 text-xs text-base-content/50 flex-shrink-0">
            {formatFileSize(node.size)}
          </span>
        )}
      </div>

      {/* Children */}
      {node.isDirectory && isExpanded && hasChildren && (
        <div className="xray-tree-children">
          {node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const XrayFileTree: React.FC<XrayFileTreeProps> = ({
  tree,
  selectedPath,
  onSelectFile,
}) => {
  return (
    <div className="xray-file-tree h-full overflow-auto" role="tree">
      <TreeNode
        node={tree}
        depth={0}
        selectedPath={selectedPath}
        onSelectFile={onSelectFile}
        defaultExpanded={true}
      />
    </div>
  );
};

export default XrayFileTree;
