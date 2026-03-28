import React, { useState } from 'react';
import { RefreshCw, FileText, Image as ImageIcon } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import { cn } from '../lib/utils';

interface AIOutputProps {
  imageUrl: string;
  onRegenerate: () => void;
  isGenerating: boolean;
}

type ExportFormat = 'png' | 'jpg' | 'pdf' | 'docx';

export const AIOutput: React.FC<AIOutputProps> = ({ imageUrl, onRegenerate, isGenerating }) => {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [showFormats, setShowFormats] = useState(false);

  const handleDownload = async () => {
    if (!imageUrl) return;

    const timestamp = Date.now();
    const fileName = `visionary-art-${timestamp}`;

    const convertToBlob = async (dataUrl: string): Promise<Blob> => {
      const response = await fetch(dataUrl);
      return await response.blob();
    };

    const convertToJpeg = (dataUrl: string): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
          }
        };
        img.src = dataUrl;
      });
    };

    switch (format) {
      case 'png': {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `${fileName}.png`;
        link.click();
        break;
      }
      case 'jpg': {
        const jpegUrl = await convertToJpeg(imageUrl);
        const link = document.createElement('a');
        link.href = jpegUrl;
        link.download = `${fileName}.jpg`;
        link.click();
        break;
      }
      case 'pdf': {
        const pdf = new jsPDF();
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
          const imgProps = pdf.getImageProperties(img);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          const format = imageUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
          pdf.addImage(imageUrl, format, 0, 0, pdfWidth, pdfHeight);
          pdf.save(`${fileName}.pdf`);
        };
        break;
      }
      case 'docx': {
        try {
          const blob = await convertToBlob(imageUrl);
          const arrayBuffer = await blob.arrayBuffer();
          const imageType = imageUrl.includes('image/jpeg') ? 'jpg' : 'png';

          const doc = new Document({
            sections: [{
              properties: {},
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: arrayBuffer,
                      transformation: {
                        width: 500,
                        height: 500,
                      },
                      type: imageType as any,
                    }),
                  ],
                }),
              ],
            }],
          });

          const docBlob = await Packer.toBlob(doc);
          saveAs(docBlob, `${fileName}.docx`);
        } catch (error) {
          console.error("DOCX Export Error:", error);
          alert("Failed to export as DOCX. Please try another format.");
        }
        break;
      }
    }
  };

  if (isGenerating) {
    return (
      <div className="w-full aspect-square bg-zinc-900 rounded-lg flex flex-col items-center justify-center gap-4 animate-pulse border border-zinc-800">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"></div>
        <p className="text-zinc-400 font-medium">Visionary AI is creating your masterpiece...</p>
      </div>
    );
  }

  if (!imageUrl) return null;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative group rounded-lg overflow-hidden shadow-2xl border border-zinc-800">
        <img 
          src={imageUrl} 
          alt="Generated Art" 
          className="w-full h-auto"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="flex flex-col gap-4">
        <button
          onClick={onRegenerate}
          className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all font-bold border border-zinc-700 hover:scale-[1.02]"
        >
          <RefreshCw size={20} />
          Regenerate Masterpiece
        </button>
        
        <div className="space-y-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black px-1">Export Options</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['png', 'jpg', 'pdf', 'docx'] as ExportFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFormat(f);
                  // Trigger download immediately for better UX
                  setTimeout(handleDownload, 0);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:scale-105",
                  format === f 
                    ? "bg-white text-black border-white shadow-lg" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                )}
              >
                {f === 'pdf' || f === 'docx' ? <FileText size={20} /> : <ImageIcon size={20} />}
                <span className="text-xs font-black uppercase italic">{f}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
