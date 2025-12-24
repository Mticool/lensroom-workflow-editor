"use client";

import { useCallback, useState, useEffect } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { SplitGridNodeData } from "@/types";
import { SplitGridSettingsModal } from "../SplitGridSettingsModal";

type SplitGridNodeType = Node<SplitGridNodeData, "splitGrid">;

export function SplitGridNode({ id, data, selected }: NodeProps<SplitGridNodeType>) {
  const nodeData = data;
  const [showSettings, setShowSettings] = useState(false);

  // Show settings modal on first creation (when not configured)
  useEffect(() => {
    if (!nodeData.isConfigured && nodeData.childNodeIds.length === 0) {
      setShowSettings(true);
    }
  }, [nodeData.isConfigured, nodeData.childNodeIds.length]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  return (
    <BaseNode
      id={id}
      title="Создать N наборов"
      selected={selected}
      hasError={nodeData.status === "error"}
    >
      {/* Reference output handle for visual links to child nodes */}
      <Handle
        type="source"
        position={Position.Right}
        id="reference"
        data-handletype="reference"
        className="!bg-gray-500"
      />

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Preview/Status area */}
        <div className="w-full flex-1 min-h-[112px] border border-dashed border-neutral-600 rounded flex flex-col items-center justify-center">
          {nodeData.status === "error" ? (
            <span className="text-[10px] text-red-400 text-center px-2">
              {nodeData.error || "Ошибка"}
            </span>
          ) : (
            <>
              <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <span className="text-neutral-400 text-[10px] mt-1 text-center">
                Генератор {nodeData.targetCount} наборов
              </span>
            </>
          )}
        </div>

        {/* Config summary */}
        <div className="flex items-center justify-between text-[10px] text-neutral-400 shrink-0">
          <span>Сетка {nodeData.gridRows}×{nodeData.gridCols} ({nodeData.targetCount} изобр.)</span>
          <button
            onClick={handleOpenSettings}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Настройки
          </button>
        </div>

        {/* Child node count / status */}
        {nodeData.isConfigured ? (
          <div className="text-[10px] text-neutral-500 shrink-0">
            Создано {nodeData.childNodeIds.length} наборов
          </div>
        ) : (
          <div className="text-[10px] text-amber-400 shrink-0">
            Не настроено — нажмите Настройки
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SplitGridSettingsModal
          nodeId={id}
          nodeData={nodeData}
          onClose={handleCloseSettings}
        />
      )}
    </BaseNode>
  );
}
