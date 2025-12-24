"use client";

import { useCallback, useEffect, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { LLMGenerateNodeData, LLMProvider, LLMModelType } from "@/types";
import { getModels } from "@/services/inferClient";
import { ModelDef } from "@/config/modelRegistry";

type LLMGenerateNodeType = Node<LLMGenerateNodeData, "llmGenerate">;

export function LLMGenerateNode({ id, data, selected }: NodeProps<LLMGenerateNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const [availableModels, setAvailableModels] = useState<ModelDef[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  
  // Upload state for NanoBanana Edit
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load available models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoadingModels(true);
        const models = await getModels();
        // For now, show all models (not just text)
        // In the future, you can filter by capability: text, image, etc.
        setAvailableModels(models);
        
        // If current model is not in the list, select first available
        if (models.length > 0 && !models.find(m => m.id === nodeData.model)) {
          updateNodeData(id, { model: models[0].id as any });
        }
      } catch (error) {
        console.error("[LLMGenerateNode] Failed to load models:", error);
        setAvailableModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };
    
    loadModels();
  }, []);

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { model: e.target.value as LLMModelType });
    },
    [id, updateNodeData]
  );

  const handleTemperatureChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { temperature: parseFloat(e.target.value) });
    },
    [id, updateNodeData]
  );

  const handleOutputsCountChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { outputsCount: parseInt(e.target.value) });
    },
    [id, updateNodeData]
  );

  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  const handleRegenerate = useCallback(() => {
    regenerateNode(id);
  }, [id, regenerateNode]);

  const handleClearOutput = useCallback(() => {
    updateNodeData(id, { outputText: null, outputUrls: [], status: "idle", error: null });
  }, [id, updateNodeData]);

  // Handle file upload for NanoBanana Edit
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();

      if (data.success && data.url) {
        // Save imageUrl to node data
        updateNodeData(id, {
          imageUrl: data.url,
          uploadedFileName: file.name,
        });
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      setUploadError(errorMessage);
      console.error("[LLMGenerateNode] Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  }, [id, updateNodeData]);

  const handleClearImage = useCallback(() => {
    updateNodeData(id, { imageUrl: undefined, uploadedFileName: undefined });
    setUploadError(null);
  }, [id, updateNodeData]);

  const currentModel = availableModels.find(m => m.id === nodeData.model);
  const isEditModel = currentModel?.id === "nano_banana_edit";

  return (
    <BaseNode
      id={id}
      title="Генератор текста (LLM)"
      selected={selected}
      hasError={nodeData.status === "error"}
    >
      {/* Text input */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ top: "50%" }}
        data-handletype="text"
      />
      {/* Text output */}
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        data-handletype="text"
      />

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Output preview area */}
        <div className="nodrag nopan nowheel relative w-full flex-1 min-h-[80px] border border-dashed border-neutral-600 rounded p-2 overflow-auto">
          {nodeData.status === "loading" ? (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              <svg
                className="w-4 h-4 animate-spin text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {nodeData.progress && nodeData.progress.total > 1 && (
                <div className="text-[10px] text-neutral-400 text-center">
                  <div>Готово {nodeData.progress.done} из {nodeData.progress.total}</div>
                  {nodeData.progress.failed && nodeData.progress.failed > 0 ? (
                    <div className="text-yellow-500">• ошибок: {nodeData.progress.failed}</div>
                  ) : null}
                </div>
              )}
            </div>
          ) : nodeData.status === "error" ? (
            <span className="text-[10px] text-red-400">
              {nodeData.error || "Ошибка"}
            </span>
          ) : nodeData.outputText ? (
            <>
              {/* Gallery view for multiple image outputs */}
              {nodeData.outputUrls && nodeData.outputUrls.length > 1 ? (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-1">
                    {nodeData.outputUrls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={url}
                          alt={`Вариант ${idx + 1}`}
                          className="w-full h-20 object-cover rounded border border-neutral-700"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                          <span className="text-[9px] text-white font-medium">Вариант {idx + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[9px] text-neutral-500 text-center">
                    {nodeData.outputUrls.length} вариантов • В граф передается первый
                    {nodeData.progress && nodeData.progress.failed && nodeData.progress.failed > 0 ? (
                      <span className="text-yellow-500"> • ошибок: {nodeData.progress.failed}</span>
                    ) : null}
                  </div>
                </div>
              ) : nodeData.outputUrls && nodeData.outputUrls.length === 1 && nodeData.outputUrls[0].startsWith('http') ? (
                /* Single image output */
                <img
                  src={nodeData.outputUrls[0]}
                  alt="Result"
                  className="w-full h-full object-contain rounded"
                />
              ) : (
                /* Text output */
                <p className="text-[10px] text-neutral-300 whitespace-pre-wrap break-words pr-6">
                  {nodeData.outputText}
                </p>
              )}
              
              {/* Action buttons */}
              <div className="absolute top-1 right-1 flex gap-1">
                <button
                  onClick={handleRegenerate}
                  disabled={isRunning}
                  className="w-5 h-5 bg-neutral-900/80 hover:bg-blue-600/80 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                  title="Перегенерировать"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={handleClearOutput}
                  className="w-5 h-5 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                  title="Очистить вывод"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <span className="text-neutral-500 text-[10px]">
                Нажмите «Запуск», чтобы сгенерировать
              </span>
            </div>
          )}
        </div>

        {/* Model selector */}
        <select
          value={nodeData.model}
          onChange={handleModelChange}
          disabled={isLoadingModels || availableModels.length === 0}
          className="w-full text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 focus:outline-none focus:ring-1 focus:ring-neutral-600 text-neutral-300 shrink-0 disabled:opacity-50"
        >
          {isLoadingModels ? (
            <option>Загрузка моделей...</option>
          ) : availableModels.length === 0 ? (
            <option>Нет доступных моделей</option>
          ) : (
            availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.capability})
              </option>
            ))
          )}
        </select>
        
        {/* Model info */}
        {currentModel && (
          <div className="text-[9px] text-neutral-500 shrink-0">
            Провайдер: {currentModel.provider} • Стоимость: {currentModel.creditCost} кредитов
          </div>
        )}

        {/* Image upload for NanoBanana Edit */}
        {isEditModel && (
          <div className="flex flex-col gap-1 shrink-0">
            <label className="text-[9px] text-neutral-500">Изображение для редактирования:</label>
            
            {nodeData.imageUrl ? (
              // Show preview
              <div className="relative border border-neutral-700 rounded p-2 bg-neutral-900/50">
                <img
                  src={nodeData.imageUrl}
                  alt="Uploaded"
                  className="w-full h-20 object-cover rounded"
                />
                <div className="mt-1 text-[9px] text-neutral-400 truncate">
                  {nodeData.uploadedFileName || "Загружено"}
                </div>
                <button
                  onClick={handleClearImage}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-600/80 hover:bg-red-600 rounded flex items-center justify-center text-white"
                  title="Удалить"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              // Show upload button
              <div className="relative">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className={`border border-dashed border-neutral-600 rounded p-3 text-center ${isUploading ? 'opacity-50' : 'hover:border-neutral-500'}`}>
                  {isUploading ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-3 h-3 animate-spin text-neutral-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-[10px] text-neutral-400">Загрузка...</span>
                    </div>
                  ) : (
                    <>
                      <svg className="w-6 h-6 mx-auto text-neutral-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[10px] text-neutral-400">Нажмите для загрузки</span>
                      <span className="text-[8px] text-neutral-600 block mt-0.5">PNG, JPEG, WebP (макс 10MB)</span>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {uploadError && (
              <div className="text-[9px] text-red-400">
                {uploadError}
              </div>
            )}
          </div>
        )}

        {/* Temperature slider */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <label className="text-[9px] text-neutral-500">Температура: {nodeData.temperature.toFixed(1)}</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={nodeData.temperature}
            onChange={handleTemperatureChange}
            className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-neutral-400"
          />
        </div>

        {/* Outputs count selector (for batch generation) */}
        {currentModel?.capability === "image" || currentModel?.capability === "video" ? (
          <div className="flex flex-col gap-0.5 shrink-0">
            <label className="text-[9px] text-neutral-500">Количество вариантов:</label>
            <select
              value={nodeData.outputsCount || 1}
              onChange={handleOutputsCountChange}
              className="w-full text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 focus:outline-none focus:ring-1 focus:ring-neutral-600 text-neutral-300"
            >
              <option value={1}>1 вариант</option>
              <option value={2}>2 варианта</option>
              <option value={4}>4 варианта</option>
              <option value={6}>6 вариантов</option>
              <option value={8}>8 вариантов</option>
              <option value={10}>10 вариантов</option>
            </select>
          </div>
        ) : null}
      </div>
    </BaseNode>
  );
}
