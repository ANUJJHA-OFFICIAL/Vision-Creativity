import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { Eraser, Pencil, Trash2, CheckCircle2, Circle, Undo2, Redo2 } from 'lucide-react';

interface SketchCanvasProps {
  onExport: (dataUrl: string) => void;
  useAsReference: boolean;
  onToggleReference: (val: boolean) => void;
  className?: string;
}

export const SketchCanvas: React.FC<SketchCanvasProps> = ({ 
  onExport, 
  useAsReference, 
  onToggleReference,
  className 
}) => {
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [lines, setLines] = useState<any[]>([]);
  const [history, setHistory] = useState<any[][]>([]);
  const [redoStack, setRedoStack] = useState<any[][]>([]);
  const isDrawing = useRef(false);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { offsetWidth } = containerRef.current;
        setSize({ width: offsetWidth, height: offsetWidth });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    setLines(prev => [...prev, { tool, points: [pos.x, pos.y] }]);
    setRedoStack([]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    setLines(prev => {
      const newLines = [...prev];
      const lastLine = { ...newLines[newLines.length - 1] };
      if (!lastLine) return prev;
      lastLine.points = [...lastLine.points, point.x, point.y];
      newLines[newLines.length - 1] = lastLine;
      return newLines;
    });
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
    setHistory([...history, [...lines]]);
    exportCanvas();
  };

  const undo = () => {
    if (lines.length === 0) return;
    const newHistory = [...history];
    const lastState = newHistory.pop();
    if (lastState) {
      setRedoStack([lastState, ...redoStack]);
      const nextState = newHistory[newHistory.length - 1] || [];
      setLines(nextState);
      setHistory(newHistory);
      setTimeout(exportCanvas, 0);
    }
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const newRedoStack = [...redoStack];
    const nextState = newRedoStack.shift();
    if (nextState) {
      setLines(nextState);
      setHistory([...history, nextState]);
      setRedoStack(newRedoStack);
      setTimeout(exportCanvas, 0);
    }
  };

  const exportCanvas = () => {
    if (stageRef.current) {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
      onExport(dataUrl);
    }
  };

  const clearCanvas = () => {
    setLines([]);
    setHistory([]);
    setRedoStack([]);
    onExport('');
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between bg-zinc-900 dark:bg-zinc-900 p-2 rounded-t-lg border-b border-zinc-800">
        <div className="flex gap-2">
          <button
            onClick={() => setTool('pen')}
            className={`p-2 rounded transition-colors ${tool === 'pen' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
            title="Pencil"
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`p-2 rounded transition-colors ${tool === 'eraser' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
            title="Eraser"
          >
            <Eraser size={18} />
          </button>
          <div className="w-px h-6 bg-zinc-800 mx-1 self-center" />
          <button
            onClick={undo}
            disabled={lines.length === 0}
            className="p-2 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-2 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Redo"
          >
            <Redo2 size={18} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => onToggleReference(!useAsReference)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
              useAsReference 
                ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
            }`}
          >
            {useAsReference ? <CheckCircle2 size={12} /> : <Circle size={12} />}
            Use as Reference
          </button>
          <button
            onClick={clearCanvas}
            className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
            title="Clear Canvas"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
      <div ref={containerRef} className="bg-white rounded-b-lg overflow-hidden sketch-canvas shadow-inner border border-zinc-800 relative aspect-square w-full">
        {size.width > 0 && (
          <Stage
            width={size.width}
            height={size.height}
            onMouseDown={handleMouseDown}
            onMousemove={handleMouseMove}
            onMouseup={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            ref={stageRef}
            style={{ cursor: tool === 'pen' ? 'crosshair' : 'default' }}
          >
            <Layer>
              {lines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke="#000000"
                  strokeWidth={line.tool === 'eraser' ? 20 : 3}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={
                    line.tool === 'eraser' ? 'destination-out' : 'source-over'
                  }
                />
              ))}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
};
