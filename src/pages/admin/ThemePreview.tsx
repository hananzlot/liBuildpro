import { useState } from "react";
import { useTheme } from "@/theme";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Sun, 
  Moon, 
  Monitor, 
  Contrast, 
  Palette, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  AlertTriangle,
  Loader2,
  ChevronRight,
  Settings,
  User,
  Bell,
  Search
} from "lucide-react";

export default function ThemePreview() {
  const { 
    themeMode, 
    colorMode, 
    contrastMode, 
    setThemeMode, 
    setColorMode, 
    setContrastMode,
    isPremium,
    isDark,
    isHighContrast
  } = useTheme();
  
  const [inputValue, setInputValue] = useState("");
  const [selectValue, setSelectValue] = useState("");
  const [switchValue, setSwitchValue] = useState(false);
  const [checkboxValue, setCheckboxValue] = useState(false);

  return (
    <AppLayout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Theme Preview</h1>
          <p className="text-muted-foreground">
            Preview all UI components in the current theme configuration.
          </p>
        </div>

        {/* Theme Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Theme Controls
            </CardTitle>
            <CardDescription>
              Toggle between themes, color modes, and accessibility options.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Theme Mode */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Theme Mode</Label>
                <div className="flex gap-2">
                  <Button
                    variant={themeMode === 'base' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setThemeMode('base')}
                  >
                    Base
                  </Button>
                  <Button
                    variant={themeMode === 'premium' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setThemeMode('premium')}
                  >
                    Premium
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Current: <Badge variant="outline">{themeMode}</Badge>
                </p>
              </div>

              {/* Color Mode */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Color Mode</Label>
                <div className="flex gap-2">
                  <Button
                    variant={colorMode === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setColorMode('light')}
                  >
                    <Sun className="h-4 w-4 mr-1" /> Light
                  </Button>
                  <Button
                    variant={colorMode === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setColorMode('dark')}
                  >
                    <Moon className="h-4 w-4 mr-1" /> Dark
                  </Button>
                  <Button
                    variant={colorMode === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setColorMode('system')}
                  >
                    <Monitor className="h-4 w-4 mr-1" /> System
                  </Button>
                </div>
              </div>

              {/* Contrast Mode */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Contrast Mode</Label>
                <div className="flex gap-2">
                  <Button
                    variant={contrastMode === 'normal' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setContrastMode('normal')}
                  >
                    Normal
                  </Button>
                  <Button
                    variant={contrastMode === 'high' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setContrastMode('high')}
                  >
                    <Contrast className="h-4 w-4 mr-1" /> High
                  </Button>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Current State */}
            <div className="flex flex-wrap gap-2">
              <Badge variant={isPremium ? "default" : "secondary"}>
                {isPremium ? "Premium Theme" : "Base Theme"}
              </Badge>
              <Badge variant={isDark ? "default" : "secondary"}>
                {isDark ? "Dark Mode" : "Light Mode"}
              </Badge>
              <Badge variant={isHighContrast ? "default" : "secondary"}>
                {isHighContrast ? "High Contrast" : "Normal Contrast"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Component Previews */}
        <Tabs defaultValue="buttons" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="buttons">Buttons</TabsTrigger>
            <TabsTrigger value="forms">Forms</TabsTrigger>
            <TabsTrigger value="cards">Cards</TabsTrigger>
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="colors">Colors</TabsTrigger>
          </TabsList>

          {/* Buttons */}
          <TabsContent value="buttons" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Button Variants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Standard Buttons</Label>
                  <div className="flex flex-wrap gap-3">
                    <Button>Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="link">Link</Button>
                    <Button variant="destructive">Destructive</Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Button Sizes</Label>
                  <div className="flex flex-wrap gap-3 items-center">
                    <Button size="sm">Small</Button>
                    <Button size="default">Default</Button>
                    <Button size="lg">Large</Button>
                    <Button size="icon"><Settings className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Button States</Label>
                  <div className="flex flex-wrap gap-3">
                    <Button disabled>Disabled</Button>
                    <Button>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Forms */}
          <TabsContent value="forms" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Form Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="input">Text Input</Label>
                    <Input 
                      id="input" 
                      placeholder="Enter text..." 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Helper text for the input field.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="select">Select</Label>
                    <Select value={selectValue} onValueChange={setSelectValue}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="option1">Option 1</SelectItem>
                        <SelectItem value="option2">Option 2</SelectItem>
                        <SelectItem value="option3">Option 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="textarea">Textarea</Label>
                    <Textarea id="textarea" placeholder="Enter longer text..." rows={3} />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Switch checked={switchValue} onCheckedChange={setSwitchValue} />
                      <Label>Toggle Switch</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox checked={checkboxValue} onCheckedChange={(v) => setCheckboxValue(!!v)} />
                      <Label>Checkbox</Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Input with Icon</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10" placeholder="Search..." />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Disabled Input</Label>
                  <Input disabled placeholder="Disabled input" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cards */}
          <TabsContent value="cards" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Basic Card
                  </CardTitle>
                  <CardDescription>A simple card with icon.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Card content goes here. Cards are used to group related content.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>Highlighted Card</CardTitle>
                  <CardDescription>With primary border color.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">Action</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Interactive Card</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Notifications</span>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Updates</span>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tables */}
          <TabsContent value="tables" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Table</CardTitle>
                <CardDescription>Example table with various data types.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">John Doe</TableCell>
                      <TableCell><Badge variant="default">Active</Badge></TableCell>
                      <TableCell>Admin</TableCell>
                      <TableCell className="text-right">$1,234.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Jane Smith</TableCell>
                      <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
                      <TableCell>User</TableCell>
                      <TableCell className="text-right">$567.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Bob Wilson</TableCell>
                      <TableCell><Badge variant="outline">Inactive</Badge></TableCell>
                      <TableCell>Viewer</TableCell>
                      <TableCell className="text-right">$89.00</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feedback */}
          <TabsContent value="feedback" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Alerts & Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Information</AlertTitle>
                  <AlertDescription>This is an informational alert message.</AlertDescription>
                </Alert>

                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>This is an error alert message.</AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <Label>Progress</Label>
                  <Progress value={66} />
                </div>

                <div className="space-y-3">
                  <Label>Loading Skeletons</Label>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Badges</Label>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="outline">Outline</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Colors */}
          <TabsContent value="colors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Color Tokens</CardTitle>
                <CardDescription>All semantic color tokens in the current theme.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { name: 'Background', class: 'bg-background border' },
                    { name: 'Foreground', class: 'bg-foreground' },
                    { name: 'Card', class: 'bg-card border' },
                    { name: 'Primary', class: 'bg-primary' },
                    { name: 'Secondary', class: 'bg-secondary' },
                    { name: 'Muted', class: 'bg-muted' },
                    { name: 'Accent', class: 'bg-accent' },
                    { name: 'Destructive', class: 'bg-destructive' },
                  ].map(({ name, class: className }) => (
                    <div key={name} className="space-y-2">
                      <div className={`h-16 rounded-lg ${className}`} />
                      <p className="text-xs font-medium text-center">{name}</p>
                    </div>
                  ))}
                </div>

                <Separator className="my-6" />

                <div className="space-y-3">
                  <Label>Sidebar Colors</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { name: 'Sidebar BG', class: 'bg-sidebar' },
                      { name: 'Sidebar Primary', class: 'bg-sidebar-primary' },
                      { name: 'Sidebar Accent', class: 'bg-sidebar-accent' },
                    ].map(({ name, class: className }) => (
                      <div key={name} className="space-y-2">
                        <div className={`h-12 rounded-lg ${className}`} />
                        <p className="text-xs font-medium text-center">{name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Enable Premium Theme</h4>
              <p className="text-sm text-muted-foreground">
                Edit <code className="bg-muted px-1.5 py-0.5 rounded text-xs">src/theme/config.ts</code> and change:
              </p>
              <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
                {`themeMode: 'premium', // Change from 'base' to 'premium'`}
              </pre>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium">Revert to Base Theme</h4>
              <p className="text-sm text-muted-foreground">
                Simply change back to <code className="bg-muted px-1.5 py-0.5 rounded text-xs">'base'</code> in the config file.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium">Runtime Switching</h4>
              <p className="text-sm text-muted-foreground">
                Use the <code className="bg-muted px-1.5 py-0.5 rounded text-xs">useTheme()</code> hook:
              </p>
              <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
{`import { useTheme } from '@/theme';

const { setThemeMode } = useTheme();
setThemeMode('premium'); // or 'base'`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
