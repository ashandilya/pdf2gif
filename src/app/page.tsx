"use client";

import { useState, useEffect, useCallback } from 'react';
import { generateGifFromPdf, GifConfig as OriginalGifConfig } from '@/services/gif-generator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Icons } from "@/components/icons";
import { SelectItem, SelectTrigger, SelectValue, SelectContent, SelectGroup, Select, SelectLabel } from "@/components/ui/select";
import { Moon, Sun, FolderSearch } from "lucide-react";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Extend GifConfig to include pageRange
interface GifConfig extends OriginalGifConfig {
  pageRange?: string;
}

function GifGenerator() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [gifConfig, setGifConfig] = useState<GifConfig>({
    frameRate: 10,
    resolution: '500xauto',
    looping: true,
    pageRange: '',
  });
  const { toast } = useToast();
  const [resolution, setResolution] = useState("500xauto");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Check system preference for theme
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const revokeGifUrl = useCallback(() => {
    if (gifUrl) {
      URL.revokeObjectURL(gifUrl);
      console.log("Revoked object URL:", gifUrl);
      setGifUrl(null);
    }
  }, [gifUrl]);

  useEffect(() => {
    // This effect handles cleanup when the component unmounts
    // or when gifUrl itself changes *before* a new one is set.
    const currentUrl = gifUrl;
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        console.log("Revoked object URL on cleanup:", currentUrl);
      }
    };
  }, [gifUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type !== 'application/pdf') {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file.",
          variant: "destructive",
        });
        event.target.value = ""; 
        setPdfFile(null);
        revokeGifUrl();
        setProgress(0);
        return;
      }

      if (file.size > MAX_PDF_SIZE_BYTES) {
        toast({
          title: "File too large",
          description: `Please select a PDF file smaller than ${MAX_PDF_SIZE_BYTES / 1024 / 1024}MB.`,
          variant: "destructive",
        });
        event.target.value = "";
        setPdfFile(null);
        revokeGifUrl();
        setProgress(0);
        return;
      }
      
      setPdfFile(file);
      revokeGifUrl(); // Revoke previous URL if exists
      setProgress(0); // Reset progress
      
      // Start generating GIF immediately when file is selected
      handleGenerateGif(file);
    }
  };

  const handleGenerateGif = async (file?: File) => {
    const pdfToUse = file || pdfFile;
    if (!pdfToUse) {
      toast({
        title: "No PDF file selected.",
        description: "Please upload a PDF file to convert.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setProgress(0); 
    revokeGifUrl(); // Revoke previous URL before generating a new one
    console.log("Starting GIF generation with config:", gifConfig);

    try {
      const blob = await generateGifFromPdf(pdfToUse, gifConfig, (p) => {
         setProgress(p); 
      });
      console.log("Generated GIF blob:", blob);
      if (blob && blob.size > 0) {
        const newGifUrl = URL.createObjectURL(blob);
        console.log("Created object URL:", newGifUrl);
        setGifUrl(newGifUrl); // Set the new URL
         toast({
            title: "GIF generated successfully!",
            description: "You can now download the GIF.",
            className: "bg-green-500 text-white",
            duration: 5000,
         });
      } else {
           throw new Error("Generated GIF blob is empty or invalid.");
      }

    } catch (error) {
      console.error("Error generating GIF in component:", error);
      toast({
        title: "Error generating GIF.",
        description: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
       setGifUrl(null); 
       setProgress(0); 
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (gifUrl) {
      const link = document.createElement('a');
      link.href = gifUrl;
      link.download = `${pdfFile?.name.replace('.pdf', '') || 'converted'}.gif`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFrameRateChange = (value: number[]) => {
    setGifConfig({ ...gifConfig, frameRate: value[0] });
  };

  const handleLoopingChange = (checked: boolean) => {
    setGifConfig({ ...gifConfig, looping: checked });
  };

  const handleResolutionChange = (value: string) => {
    setResolution(value);
    setGifConfig({ ...gifConfig, resolution: value });
  }

  useEffect(() => {
    if (pdfFile) {
      handleGenerateGif(pdfFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifConfig.frameRate, gifConfig.resolution, gifConfig.looping]);

  if (!isClient) {
    return (
       <div className="flex items-center justify-center min-h-screen">
         <Icons.loader className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-background p-2 sm:p-4 md:p-8">
      <header className="w-full max-w-4xl flex flex-col items-center py-4 sm:py-6 mb-4 sm:mb-8">
        <h1 className="text-3xl sm:text-5xl font-bold text-primary text-center mb-2">PDF2GIF</h1>
        <div className="flex justify-end w-full mb-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
        </div>
        <p className="text-center text-muted-foreground mt-2 text-sm sm:text-base">Easily convert your PDF files into animated GIFs</p>
        <p className="text-center text-muted-foreground mt-2 text-xs sm:text-base">
          Know the person behind this? <a href="https://www.linkedin.com/in/ashandilya64/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Connect on LinkedIn</a>
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mb-3">
        {/* Choose PDF File Card */}
        <div className="border rounded p-4 flex items-center justify-center h-[70px] bg-white dark:bg-black">
          <Label htmlFor="pdf-upload" className="w-full flex items-center justify-center cursor-pointer">
            <Button type="button" className="text-sm px-4 py-2" asChild>
              <span>Choose PDF File</span>
            </Button>
            <Input id="pdf-upload" type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
          </Label>
        </div>
        {/* Frame Rate & Loop GIF Card */}
        <div className="border rounded p-4 flex items-center justify-between h-[70px] bg-white dark:bg-black">
          <span className="text-sm font-medium mr-2">Frame Rate</span>
          <Slider
            id="frame-rate"
            defaultValue={[gifConfig.frameRate]}
            min={1}
            max={30}
            step={1}
            onValueChange={handleFrameRateChange}
            aria-label="Frame Rate"
            className="flex-1 mx-2"
          />
          <span className="text-sm font-medium mx-2">Loop GIF</span>
          <Switch
            id="looping"
            checked={gifConfig.looping}
            onCheckedChange={handleLoopingChange}
            aria-label="Loop GIF"
            className="scale-90"
          />
        </div>
      </div>
      {/* Preview & Download Card */}
      <div className="border rounded p-4 w-full max-w-2xl min-h-[400px] flex flex-col" style={{ minHeight: '400px' }}>
        <div>
          <span className="font-semibold text-sm">Preview & Download</span>
          <div className="text-xs text-muted-foreground mb-4">Your generated GIF will appear here.</div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          {!gifUrl && (
            <span className="text-sm text-center">Upload a PDF to generate a GIF.</span>
          )}
          {/* GIF preview will go here if gifUrl exists */}
        </div>
      </div>
      <footer className="w-full max-w-4xl text-center mt-8 sm:mt-12 py-4 sm:py-6 border-t">
        <p className="text-xs sm:text-sm text-muted-foreground">&copy; {new Date().getFullYear()} PDF2GIF. All rights reserved.</p>
      </footer>
    </div>
  );
}


export default function Home() {
  return <GifGenerator />;
}

