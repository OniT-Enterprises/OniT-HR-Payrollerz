/**
 * Simple local authentication system - no Firebase dependencies
 * Uses localStorage for session persistence
 */

export interface LocalUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "hr" | "employee";
  company: string;
  loginTime: Date;
}

export interface LocalSession {
  user: LocalUser;
  isAuthenticated: boolean;
  token: string;
}

// Default users for development
const DEFAULT_USERS: Omit<LocalUser, "loginTime">[] = [
  {
    id: "user_1",
    email: "celestinod@gmail.com",
    name: "Celestino de Freitas",
    role: "admin",
    company: "OniT Solutions",
  },
  {
    id: "user_2",
    email: "admin@company.com",
    name: "Admin User",
    role: "admin",
    company: "Demo Company",
  },
  {
    id: "user_3",
    email: "hr@company.com",
    name: "HR Manager",
    role: "hr",
    company: "Demo Company",
  },
];

class LocalAuthService {
  private currentSession: LocalSession | null = null;
  private sessionKey = "hr_app_session";

  constructor() {
    this.loadSession();
  }

  /**
   * Sign in with email (password ignored for development)
   */
  signIn(email: string, password?: string): LocalUser | null {
    console.log("🔐 Local sign in for:", email);

    // Find user by email
    let user = DEFAULT_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );

    // If not found, create new user automatically
    if (!user) {
      user = {
        id: `user_${Date.now()}`,
        email: email,
        name: email.split("@")[0], // Use email prefix as name
        role: "admin", // Default role
        company: `${email.split("@")[0]}'s Company`,
      };
      console.log("✨ Creating new user:", user);
    }

    const fullUser: LocalUser = {
      ...user,
      loginTime: new Date(),
    };

    // Create session
    this.currentSession = {
      user: fullUser,
      isAuthenticated: true,
      token: `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    // Save to localStorage
    this.saveSession();

    console.log("✅ Local sign in successful:", fullUser.name);
    return fullUser;
  }

  /**
   * Sign out current user
   */
  signOut(): void {
    console.log("🔐 Local sign out");
    this.currentSession = null;
    localStorage.removeItem(this.sessionKey);
  }

  /**
   * Get current session
   */
  getSession(): LocalSession | null {
    return this.currentSession;
  }

  /**
   * Get current user
   */
  getCurrentUser(): LocalUser | null {
    return this.currentSession?.user || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentSession?.isAuthenticated || false;
  }

  /**
   * Save session to localStorage
   */
  private saveSession(): void {
    if (this.currentSession) {
      localStorage.setItem(
        this.sessionKey,
        JSON.stringify(this.currentSession),
      );
    }
  }

  /**
   * Load session from localStorage
   */
  private loadSession(): void {
    try {
      const sessionData = localStorage.getItem(this.sessionKey);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        // Convert loginTime back to Date object
        if (session.user?.loginTime) {
          session.user.loginTime = new Date(session.user.loginTime);
        }
        this.currentSession = session;
        console.log("🔄 Session restored for:", session.user?.name);
      }
    } catch (error) {
      console.warn("Failed to load session:", error);
      this.currentSession = null;
    }
  }

  /**
   * Get all available users (for development)
   */
  getAvailableUsers(): Omit<LocalUser, "loginTime">[] {
    return DEFAULT_USERS;
  }
}

// Create singleton instance
export const localAuth = new LocalAuthService();

// Helper functions
export const signInLocal = (email: string, password?: string) =>
  localAuth.signIn(email, password);
export const signOutLocal = () => localAuth.signOut();
export const getCurrentUser = () => localAuth.getCurrentUser();
export const isAuthenticated = () => localAuth.isAuthenticated();
export const getSession = () => localAuth.getSession();

console.log("🔧 Local authentication system initialized");
