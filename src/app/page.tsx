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
import { Moon, Sun, FolderSearch, Upload, Image, Settings, Download } from "lucide-react";

const MAX_PDF_SIZE_BYTES = 40 * 1024 * 1024; // 40MB

// Extend GifConfig to include pageRange
interface GifConfig extends OriginalGifConfig {
  pageRange?: string;
}

function GifGenerator() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [resolution, setResolution] = useState('medium');
  const [gifConfig, setGifConfig] = useState<GifConfig>({
    frameRate: 10,
    resolution: '720xauto', // Default to medium resolution
    looping: true,
  });

  const { toast } = useToast();

  // Cleanup function for object URLs
  const cleanupGifUrl = useCallback(() => {
    if (gifUrl) {
      URL.revokeObjectURL(gifUrl);
      setGifUrl(null);
    }
  }, [gifUrl]);

  useEffect(() => {
    setIsClient(true);
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(savedTheme);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupGifUrl();
    };
  }, [cleanupGifUrl]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(newTheme);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_PDF_SIZE_BYTES) {
        toast({
          title: "File too large",
          description: "Please upload a PDF file smaller than 40MB",
          variant: "destructive",
        });
        return;
      }
      cleanupGifUrl(); // Cleanup previous GIF URL
      setPdfFile(file);
      handleGenerateGif(file);
    }
  };

  const handleGenerateGif = async (file: File) => {
    try {
      setIsGenerating(true);
      cleanupGifUrl(); // Cleanup previous GIF URL before generating new one
      const gifBlob = await generateGifFromPdf(file, gifConfig);
      const url = URL.createObjectURL(gifBlob);
      setGifUrl(url);
      toast({
        title: "Success!",
        description: "Your GIF has been generated successfully",
      });
    } catch (error) {
      console.error('Error generating GIF:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate GIF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
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
    // Map resolution values to actual dimensions
    const resolutionMap: Record<string, string> = {
      'low': '480xauto',
      'medium': '720xauto',
      'high': '1080xauto'
    };
    setGifConfig({ ...gifConfig, resolution: resolutionMap[value] });
  }

  useEffect(() => {
    if (pdfFile) {
      handleGenerateGif(pdfFile);
    }
  }, [gifConfig.frameRate, gifConfig.resolution, gifConfig.looping]);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icons.loader className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <div className="flex justify-end mb-4">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="hover:bg-accent">
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 mb-4">
            PDF2GIF
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
            Transform your PDF documents into stunning animated GIFs with just a few clicks
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Upload Section */}
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderSearch className="h-6 w-6 text-primary" />
                Upload PDF
              </CardTitle>
              <CardDescription>
                Drag and drop your PDF file or click to browse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors duration-300">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-4">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground">PDF files up to 40MB</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Settings Section */}
          <Card className="hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-6 w-6 text-primary" />
                GIF Settings
              </CardTitle>
              <CardDescription>
                Customize your GIF output settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Frame Rate</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[gifConfig.frameRate]}
                    onValueChange={handleFrameRateChange}
                    min={1}
                    max={30}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12">{gifConfig.frameRate} fps</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Resolution</Label>
                <Select value={resolution} onValueChange={handleResolutionChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select resolution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Resolution Options</SelectLabel>
                      <SelectItem value="low">Low (480p)</SelectItem>
                      <SelectItem value="medium">Medium (720p)</SelectItem>
                      <SelectItem value="high">High (1080p)</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="looping">Loop Animation</Label>
                <Switch
                  id="looping"
                  checked={gifConfig.looping}
                  onCheckedChange={handleLoopingChange}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Section */}
        <div className="mt-8 max-w-4xl mx-auto">
          <Card className="hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-6 w-6 text-primary" />
                Preview
              </CardTitle>
              <CardDescription>
                Your generated GIF will appear here
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted/20 rounded-lg flex items-center justify-center overflow-hidden">
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-4">
                    <Icons.loader className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Generating your GIF...</p>
                  </div>
                ) : gifUrl ? (
                  <img
                    src={gifUrl}
                    alt="Generated GIF"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <p>Upload a PDF to generate your GIF</p>
                  </div>
                )}
              </div>
            </CardContent>
            {gifUrl && (
              <CardFooter className="flex justify-end">
                <Button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = gifUrl;
                    link.download = 'converted.gif';
                    link.click();
                  }}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download GIF
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>Created with ❤️ by <a href="https://www.linkedin.com/in/ashandilya64/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Anshu Shandilya</a></p>
          <p className="mt-2">&copy; {new Date().getFullYear()} PDF2GIF. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

export default function Home() {
  return <GifGenerator />;
}

