import React from 'react';
import { ArtStyle } from '../types';
import { ART_STYLES } from '../constants';
import { cn } from '../lib/utils';

interface StyleSelectorProps {
  selectedStyle: ArtStyle;
  onSelect: (style: ArtStyle) => void;
  className?: string;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({ selectedStyle, onSelect, className }) => {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Art Style</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar style-selector">
        {ART_STYLES.map((style) => (
          <button
            key={style.label}
            onClick={() => onSelect(style.label)}
            className={cn(
              "flex flex-col items-start p-3 rounded-lg border transition-all text-left",
              selectedStyle === style.label
                ? "bg-white border-white text-black shadow-lg scale-[1.02]"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            )}
          >
            <span className="text-sm font-bold">{style.label}</span>
            <span className="text-[10px] opacity-70 line-clamp-1">{style.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
