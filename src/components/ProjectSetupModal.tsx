"use client";

import { useState, useEffect } from "react";
import { generateWorkflowId, useWorkflowStore } from "@/store/workflowStore";

interface ProjectSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, name: string, directoryPath: string, generationsPath: string | null) => void;
  mode: "new" | "settings";
}

export function ProjectSetupModal({
  isOpen,
  onClose,
  onSave,
  mode,
}: ProjectSetupModalProps) {
  const { workflowName, saveDirectoryPath, generationsPath } = useWorkflowStore();

  const [name, setName] = useState("");
  const [directoryPath, setDirectoryPath] = useState("");
  const [genPath, setGenPath] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isBrowsingWorkflow, setIsBrowsingWorkflow] = useState(false);
  const [isBrowsingGen, setIsBrowsingGen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill when opening in settings mode
  useEffect(() => {
    if (isOpen && mode === "settings") {
      setName(workflowName || "");
      setDirectoryPath(saveDirectoryPath || "");
      setGenPath(generationsPath || "");
    } else if (isOpen && mode === "new") {
      setName("");
      setDirectoryPath("");
      setGenPath("");
    }
  }, [isOpen, mode, workflowName, saveDirectoryPath, generationsPath]);

  const handleBrowse = async (target: "workflow" | "generations") => {
    const setIsBrowsing = target === "workflow" ? setIsBrowsingWorkflow : setIsBrowsingGen;
    const setPath = target === "workflow" ? setDirectoryPath : setGenPath;

    setIsBrowsing(true);
    setError(null);

    try {
      const response = await fetch("/api/browse-directory");
      const result = await response.json();

      if (!result.success) {
        setError(result.error || "Failed to open directory picker");
        return;
      }

      if (result.cancelled) {
        return;
      }

      if (result.path) {
        setPath(result.path);
      }
    } catch (err) {
      setError(
        `Failed to open directory picker: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    if (!directoryPath.trim()) {
      setError("Workflow directory is required");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Validate workflow directory exists
      const response = await fetch(
        `/api/workflow?path=${encodeURIComponent(directoryPath.trim())}`
      );
      const result = await response.json();

      if (!result.exists) {
        setError("Workflow directory does not exist");
        setIsValidating(false);
        return;
      }

      if (!result.isDirectory) {
        setError("Workflow path is not a directory");
        setIsValidating(false);
        return;
      }

      // Validate generations directory if provided
      if (genPath.trim()) {
        const genResponse = await fetch(
          `/api/workflow?path=${encodeURIComponent(genPath.trim())}`
        );
        const genResult = await genResponse.json();

        if (!genResult.exists) {
          setError("Generations directory does not exist");
          setIsValidating(false);
          return;
        }

        if (!genResult.isDirectory) {
          setError("Generations path is not a directory");
          setIsValidating(false);
          return;
        }
      }

      const id = mode === "new" ? generateWorkflowId() : useWorkflowStore.getState().workflowId || generateWorkflowId();
      onSave(id, name.trim(), directoryPath.trim(), genPath.trim() || null);
      setIsValidating(false);
    } catch (err) {
      setError(
        `Failed to validate directories: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      setIsValidating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isValidating && !isBrowsingWorkflow && !isBrowsingGen) {
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const isBrowsing = isBrowsingWorkflow || isBrowsingGen;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div
        className="bg-neutral-800 rounded-lg p-6 w-[480px] border border-neutral-700 shadow-xl"
        onKeyDown={handleKeyDown}
      >
        <h2 className="text-lg font-semibold text-neutral-100 mb-4">
          {mode === "new" ? "New Project" : "Project Settings"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              autoFocus
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-neutral-100 text-sm focus:outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              Workflow Directory
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={directoryPath}
                onChange={(e) => setDirectoryPath(e.target.value)}
                placeholder="/Users/username/projects"
                className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-neutral-100 text-sm focus:outline-none focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={() => handleBrowse("workflow")}
                disabled={isBrowsing}
                className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-sm rounded transition-colors"
              >
                {isBrowsingWorkflow ? "..." : "Browse"}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Where the workflow JSON file will be saved
            </p>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              Generations Directory
              <span className="text-neutral-500 ml-1">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={genPath}
                onChange={(e) => setGenPath(e.target.value)}
                placeholder="/Users/username/generations"
                className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-neutral-100 text-sm focus:outline-none focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={() => handleBrowse("generations")}
                disabled={isBrowsing}
                className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-sm rounded transition-colors"
              >
                {isBrowsingGen ? "..." : "Browse"}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Generated images will be automatically saved here
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isValidating || isBrowsing}
            className="px-4 py-2 text-sm bg-white text-neutral-900 rounded hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isValidating ? "Validating..." : mode === "new" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
