"use client";

import { useEffect, useState, useRef, ReactNode } from "react";

// Define types for our curve animations
interface CurvePoint {
  x: number;
  y: number;
  cpx1: number; // Control point 1 x
  cpy1: number; // Control point 1 y
  cpx2: number; // Control point 2 x
  cpy2: number; // Control point 2 y
}

interface AnimatedPath {
  points: CurvePoint[];
  progress: number;
  speed: number;
  dashLength: number;
  dashGap: number;
  opacity: number;
  width: number;
  maxProgress: number;
}

// Define the type for features
interface Feature {
  title: string;
  description: string;
  icon: ReactNode;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [formType, setFormType] = useState<"login" | "signup">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Form data state
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Validate form data
      if (formType === "signup") {
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Passwords do not match");
        }
        
        if (formData.password.length < 6) {
          throw new Error("Password must be at least 6 characters long");
        }
      }

      // Determine which API endpoint to call
      const endpoint = formType === "login" ? "/api/auth/login" : "/api/auth/signup";
      
      // Prepare request body
      const requestBody = formType === "login" 
        ? { identifier: formData.email, password: formData.password }
        : { username: formData.username, email: formData.email, password: formData.password };
      
      // Make the API call
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      // Handle successful authentication
      const { token, user } = data.data;
      
      // Save token to localStorage
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      
      // Redirect to dashboard or another page
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const resizeCanvas = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    
    // Create curved paths
    const paths: AnimatedPath[] = [];
    const pathCount = 35; // Increased number of paths for better coverage
    
    // Helper function to generate a smooth curve across the screen
    const generateCurve = (startSide: 'left' | 'right' | 'top' | 'bottom') => {
      const width = canvas.width;
      const height = canvas.height;
      
      // Random start position based on the chosen side
      let startX: number, startY: number;
      let endX: number, endY: number;
      
      // Define start position
      if (startSide === 'left') {
        startX = 0;
        startY = Math.random() * height;
        // End on right or bottom
        if (Math.random() > 0.5) {
          endX = width;
          endY = Math.random() * height;
        } else {
          endX = Math.random() * width;
          endY = height;
        }
      } else if (startSide === 'right') {
        startX = width;
        startY = Math.random() * height;
        // End on left or bottom
        if (Math.random() > 0.5) {
          endX = 0;
          endY = Math.random() * height;
        } else {
          endX = Math.random() * width;
          endY = height;
        }
      } else if (startSide === 'top') {
        startX = Math.random() * width;
        startY = 0;
        // End on bottom or side
        if (Math.random() > 0.5) {
          endX = Math.random() * width;
          endY = height;
        } else {
          endX = Math.random() > 0.5 ? 0 : width;
          endY = Math.random() * height;
        }
      } else { // bottom
        startX = Math.random() * width;
        startY = height;
        // End on top or side
        if (Math.random() > 0.5) {
          endX = Math.random() * width;
          endY = 0;
        } else {
          endX = Math.random() > 0.5 ? 0 : width;
          endY = Math.random() * height;
        }
      }
      
      // Generate a curve with multiple control points for a more natural path
      const points: CurvePoint[] = [];
      const segments = 2 + Math.floor(Math.random() * 3); // 2-4 segments
      
      // First point
      points.push({
        x: startX,
        y: startY,
        cpx1: startX + (Math.random() * width * 0.2) * (Math.random() > 0.5 ? 1 : -1),
        cpy1: startY + (Math.random() * height * 0.2) * (Math.random() > 0.5 ? 1 : -1),
        cpx2: startX + (Math.random() * width * 0.3) * (Math.random() > 0.5 ? 1 : -1),
        cpy2: startY + (Math.random() * height * 0.3) * (Math.random() > 0.5 ? 1 : -1)
      });
      
      // Generate intermediate points
      for (let i = 1; i < segments; i++) {
        const progress = i / segments;
        const midX = startX + (endX - startX) * progress + (Math.random() * width * 0.2 - width * 0.1);
        const midY = startY + (endY - startY) * progress + (Math.random() * height * 0.2 - height * 0.1);
        
        points.push({
          x: midX,
          y: midY,
          cpx1: midX + (Math.random() * width * 0.2) * (Math.random() > 0.5 ? 1 : -1),
          cpy1: midY + (Math.random() * height * 0.2) * (Math.random() > 0.5 ? 1 : -1),
          cpx2: midX + (Math.random() * width * 0.3) * (Math.random() > 0.5 ? 1 : -1),
          cpy2: midY + (Math.random() * height * 0.3) * (Math.random() > 0.5 ? 1 : -1)
        });
      }
      
      // Last point
      points.push({
        x: endX,
        y: endY,
        cpx1: endX + (Math.random() * width * 0.2) * (Math.random() > 0.5 ? 1 : -1),
        cpy1: endY + (Math.random() * height * 0.2) * (Math.random() > 0.5 ? 1 : -1),
        cpx2: endX + (Math.random() * width * 0.3) * (Math.random() > 0.5 ? 1 : -1),
        cpy2: endY + (Math.random() * height * 0.3) * (Math.random() > 0.5 ? 1 : -1)
      });
      
      return points;
    };
    
    // Create paths
    for (let i = 0; i < pathCount; i++) {
      const startSide = ['left', 'right', 'top', 'bottom'][Math.floor(Math.random() * 4)] as 'left' | 'right' | 'top' | 'bottom';
      const curvePoints = generateCurve(startSide);
      
      // Random properties for the path
      paths.push({
        points: curvePoints,
        progress: 0,
        speed: 0.0005 + Math.random() * 0.0004, // Varying speeds for more randomness
        dashLength: 5 + Math.random() * 10,
        dashGap: 3 + Math.random() * 8,
        opacity: 0.07 + Math.random() * 0.1, // Darker lines
        width: 0.3 + Math.random() * 0.4, // Thin lines
        maxProgress: 0.6 + Math.random() * 0.3 // Different max progress for each line
      });
    }
    
    // Draw a curved path with the current progress
    const drawPath = (path: AnimatedPath) => {
      if (!ctx) return;
      
      ctx.beginPath();
      ctx.lineWidth = path.width;
      ctx.strokeStyle = `rgba(0, 0, 0, ${path.opacity})`;
      ctx.setLineDash([path.dashLength, path.dashGap]);
      
      // Calculate the total path length to make the dash pattern consistent
      const totalLength = path.points.length * 100; // Approximation
      const dashOffset = (path.progress * totalLength) % (path.dashLength + path.dashGap);
      ctx.lineDashOffset = -dashOffset;
      
      // Draw the path through all points
      for (let i = 0; i < path.points.length - 1; i++) {
        const current = path.points[i];
        const next = path.points[i + 1];
        
        if (i === 0) {
          ctx.moveTo(current.x, current.y);
        }
        
        // Use bezier curve to create smooth path
        ctx.bezierCurveTo(
          current.cpx2, current.cpy2,
          next.cpx1, next.cpy1,
          next.x, next.y
        );
      }
      
      ctx.stroke();
    };
    
    // Helper function to get a point along the path at a specific progress
    const getPointOnPath = (path: AnimatedPath, progress: number) => {
      // Determine which segment we're in
      const segmentCount = path.points.length - 1;
      const segmentProgress = progress * segmentCount;
      const segmentIndex = Math.min(Math.floor(segmentProgress), segmentCount - 1);
      const t = segmentProgress - segmentIndex;
      
      const p1 = path.points[segmentIndex];
      const p2 = path.points[segmentIndex + 1];
      
      // Cubic Bezier curve formula
      const bezierPoint = (t: number, p0: number, p1: number, p2: number, p3: number) => {
        const u = 1 - t;
        return Math.pow(u, 3) * p0 + 
               3 * Math.pow(u, 2) * t * p1 + 
               3 * u * Math.pow(t, 2) * p2 + 
               Math.pow(t, 3) * p3;
      };
      
      return {
        x: bezierPoint(t, p1.x, p1.cpx2, p2.cpx1, p2.x),
        y: bezierPoint(t, p1.y, p1.cpy2, p2.cpy1, p2.y)
      };
    };
    
    // Create a randomized distribution of progress values
    // This ensures lines are at different stages in their lifecycle
    paths.forEach((path, index) => {
      path.progress = Math.random() * path.maxProgress;
    });
    
    // Animation loop
    const animate = (currentTime: number) => {
      if (!ctx || !canvas) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw all paths
      paths.forEach((path, pathIndex) => {
        // Update progress very slowly
        path.progress += path.speed;
        
        // Instead of resetting abruptly, create a fade out effect
        let opacity = path.opacity;
        
        // When approaching the end, start fading out
        if (path.progress > path.maxProgress * 0.85) {
          // Calculate how close we are to the end (0 to 1)
          const endProgress = (path.progress - path.maxProgress * 0.85) / (path.maxProgress * 0.15);
          // Fade out gradually
          opacity = path.opacity * (1 - endProgress);
        }
        
        // Also fade in at the beginning
        if (path.progress < 0.15) {
          // Fade in gradually
          opacity = path.opacity * (path.progress / 0.15);
        }
        
        // Store original opacity
        const originalOpacity = path.opacity;
        // Temporarily set opacity for drawing
        path.opacity = opacity;
        
        // Draw the path
        drawPath(path);
        
        // Restore original opacity
        path.opacity = originalOpacity;
        
        // Reset path when it completes, but only after it has faded out
        if (path.progress >= path.maxProgress) {
          // Generate a new path
          const startSide = ['left', 'right', 'top', 'bottom'][Math.floor(Math.random() * 4)] as 'left' | 'right' | 'top' | 'bottom';
          path.points = generateCurve(startSide);
          path.progress = 0;
          path.dashLength = 5 + Math.random() * 10;
          path.dashGap = 3 + Math.random() * 8;
          path.opacity = 0.07 + Math.random() * 0.1; // Darker lines
          path.width = 0.3 + Math.random() * 0.4;
          path.maxProgress = 0.6 + Math.random() * 0.3;
          
          // Randomize the new line's speed
          path.speed = 0.0005 + Math.random() * 0.0004;
        }
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate(0);
    
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <>
      <canvas 
        ref={canvasRef}
        className="fixed top-0 left-0 w-full h-full -z-10 bg-white"
      />
      <div className="relative flex flex-col items-center min-h-screen text-black">
        <header className="w-full py-6 px-8">
          <div className="max-w-5xl mx-auto flex justify-between items-center">
            <div className="text-2xl font-bold tracking-tight">MOSAIC</div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-md mx-auto px-8 py-16 flex flex-col items-center justify-center">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-light mb-3 tracking-tight">
              Welcome
            </h1>
            <p className="text-gray-500 mb-8">
              {formType === "login" ? "Sign in to continue to your workspace" : "Create an account to get started"}
            </p>
          </div>

          {/* Auth Form Tabs */}
          <div className="w-full flex border-b border-gray-200 mb-6">
            <button
              className={`flex-1 py-3 font-medium text-center ${
                formType === "login"
                  ? "text-black border-b-2 border-black"
                  : "text-gray-500 hover:text-black"
              }`}
              onClick={() => setFormType("login")}
            >
              Sign In
            </button>
            <button
              className={`flex-1 py-3 font-medium text-center ${
                formType === "signup"
                  ? "text-black border-b-2 border-black"
                  : "text-gray-500 hover:text-black"
              }`}
              onClick={() => setFormType("signup")}
            >
              Sign Up
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="w-full mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-5 backdrop-blur-sm bg-white/50 p-8 rounded-lg shadow-sm border border-gray-100">
            {/* Username field - only for signup */}
            {formType === "signup" && (
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200"
                  placeholder="johndoe"
                  required
                />
              </div>
            )}
            
            {/* Email field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200"
                placeholder="your@email.com"
                required
              />
            </div>
            
            {/* Password field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200"
                placeholder="••••••••"
                required
              />
            </div>
            
            {/* Confirm Password - only for signup */}
            {formType === "signup" && (
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}
            
            {/* Remember me and Forgot password - only for login */}
            {formType === "login" && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 border-gray-300 rounded text-black focus:ring-black"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>
                
                <a href="#" className="text-sm text-gray-600 hover:text-black transition-colors">
                  Forgot password?
                </a>
              </div>
            )}
            
            {/* Submit button */}
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-black text-white py-3 px-4 rounded-md hover:bg-gray-800 transition-all duration-200 font-medium flex items-center justify-center"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              ) : null}
              {formType === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </main>

        <footer className="w-full py-6 text-center text-gray-400 text-sm">
          <div className="max-w-5xl mx-auto px-8">
            © {mounted ? new Date().getFullYear() : ''} Mosaic
          </div>
        </footer>
      </div>
    </>
  );
}
