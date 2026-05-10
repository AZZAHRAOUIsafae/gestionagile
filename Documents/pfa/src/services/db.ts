import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  Timestamp,
  serverTimestamp,
  addDoc,
  orderBy,
  or,
  and,
  arrayUnion,
  limit
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { User, Project, ProjectDocument, Message, Notification, UserRole, Intervention, ConnectionRequest, Review, FailedLoginLog } from '../types';

enum OperationType {
  // ...
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const dbService = {
  // Users
  async getUser(uid: string): Promise<User | null> {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { id: docSnap.id, ...(docSnap.data() as any) } as User : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async createUser(user: User): Promise<void> {
    const path = `users/${user.id}`;
    try {
      await setDoc(doc(db, 'users', user.id), {
        uid: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        age: user.age || 18,
        country: user.country || 'Morocco',
        city: user.city || '',
        company: user.company || '',
        isTwoFactorEnabled: user.isTwoFactorEnabled || false,
        blockedUids: user.blockedUids || [],
        loginHistory: user.loginHistory || [],
        createdAt: serverTimestamp(),
        status: 'online',
        lastSeen: serverTimestamp()
      });

      // Notify Admins
      const admins = await this.getAdmins();
      for (const admin of admins) {
        await this.createNotification({
          userId: admin.id,
          senderId: user.id,
          senderName: user.name,
          type: 'ALERT',
          content: `Nouvel utilisateur inscrit : ${user.name} (${user.role})`,
          link: '/admin'
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async updateUser(uid: string, data: Partial<User>): Promise<void> {
    const path = `users/${uid}`;
    if (!uid) return;
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeToUsers(callback: (users: User[]) => void, adminEmail?: string) {
    const path = 'users';
    let q = query(collection(db, 'users'), orderBy('name', 'asc'));
    
    if (adminEmail) {
      q = query(collection(db, 'users'), where('adminEmail', '==', adminEmail), orderBy('name', 'asc'));
    }

    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as User));
      callback(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  async getAllUsers(adminEmail?: string): Promise<User[]> {
    const path = 'users';
    try {
      let q: any = collection(db, 'users');
      if (adminEmail) {
        q = query(q, where('adminEmail', '==', adminEmail));
      }
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as User));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async getAdmins(): Promise<User[]> {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'ADMIN'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as User));
    } catch (error) {
      console.error("Failed to get admins:", error);
      return [];
    }
  },

  async getAdminByEmail(email: string): Promise<User | null> {
    try {
      const q = query(collection(db, 'users'), where('email', '==', email), where('role', '==', 'ADMIN'), limit(1));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...(doc.data() as any) } as User;
    } catch (error) {
      console.error("Failed to get admin by email:", error);
      return null;
    }
  },

  // --- Connection Requests ---
  async sendConnectionRequest(sender: User, receiverId: string): Promise<string> {
    const path = 'connectionRequests';
    try {
      const docRef = await addDoc(collection(db, path), {
        senderId: sender.id,
        senderName: sender.name,
        senderEmail: sender.email,
        receiverId: receiverId,
        status: 'PENDING',
        createdAt: serverTimestamp(),
        type: 'CLIENT_TO_PRO'
      });

      // Create notification for receiver
      await this.createNotification({
        userId: receiverId,
        senderId: sender.id,
        senderName: sender.name,
        type: 'ALERT',
        content: `Nouvelle demande de liaison de part de ${sender.name}`,
        link: '/settings' // Or a specific connections page
      });

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  subscribeToIncomingRequests(userId: string, callback: (reqs: ConnectionRequest[]) => void) {
    const q = query(collection(db, 'connectionRequests'), where('receiverId', '==', userId), where('status', '==', 'PENDING'));
    return onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as ConnectionRequest));
      callback(reqs);
    });
  },

  async handleConnectionRequest(requestId: string, status: 'ACCEPTED' | 'REJECTED'): Promise<void> {
    const path = `connectionRequests/${requestId}`;
    try {
      const reqDoc = await getDoc(doc(db, 'connectionRequests', requestId));
      if (!reqDoc.exists()) throw new Error("Request not found");
      const requestData = reqDoc.data() as ConnectionRequest;

      await updateDoc(doc(db, 'connectionRequests', requestId), { status });

      if (status === 'ACCEPTED') {
        const receiver = await this.getUser(requestData.receiverId);
        
        // Link Client to Pro (Topographer or Admin)
        await updateDoc(doc(db, 'users', requestData.senderId), {
          linkedTopographerId: requestData.receiverId,
          adminEmail: receiver?.role === 'ADMIN' ? receiver.email : receiver?.adminEmail,
          adminId: receiver?.role === 'ADMIN' ? receiver.id : receiver?.adminId
        });
      }

      // Notify sender
      await this.createNotification({
        userId: requestData.senderId,
        senderId: requestData.receiverId,
        senderName: 'Système',
        type: 'ALERT',
        content: `Votre demande de liaison a été ${status === 'ACCEPTED' ? 'acceptée' : 'refusée'}.`,
        link: '/search'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async updatePresence(uid: string, status: 'online' | 'offline'): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        status,
        lastSeen: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to update presence:", error);
    }
  },

  subscribeToProjects(role: UserRole, userId: string, callback: (projects: Project[]) => void, adminEmail?: string) {
    const path = 'projects';
    const q = role === 'ADMIN' 
      ? (adminEmail 
          ? query(collection(db, 'projects'), where('adminEmail', '==', adminEmail), orderBy('createdAt', 'desc'))
          : query(collection(db, 'projects'), orderBy('createdAt', 'desc')))
      : role === 'TOPOGRAPHER'
        ? query(collection(db, 'projects'), where('topographerId', '==', userId), orderBy('createdAt', 'desc'))
        : query(collection(db, 'projects'), where('clientId', '==', userId), orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const prjs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Project));
      callback(prjs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  async getTopographers(): Promise<User[]> {
    const path = 'users';
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'TOPOGRAPHER'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as User));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async logLogin(uid: string, info: { location: string, device: string }): Promise<void> {
    const path = `users/${uid}`;
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        
        // Track new device alert
        const isNewDevice = userData.lastDeviceInfo && (userData.lastDeviceInfo.device !== info.device);
        const isNewLocation = userData.lastDeviceInfo && (userData.lastDeviceInfo.location !== info.location);

        const newLoginHistory = [
          { id: Math.random().toString(36).substr(2, 9), ...info, timestamp: new Date().toISOString() },
          ...(userData.loginHistory || []).slice(0, 19) // Keep last 20
        ];

        const loginCount = (userData.loginCount || 0) + 1;

        await updateDoc(userRef, { 
          loginHistory: newLoginHistory,
          loginCount: loginCount,
          lastDeviceInfo: info,
          status: 'online',
          lastSeen: serverTimestamp()
        });

        // Trigger Security Alert if detected new device/location
        if (isNewDevice || isNewLocation) {
          await this.createNotification({
            userId: uid,
            senderId: 'system',
            senderName: 'Sécurité Système',
            type: 'ALERT',
            content: `Nouvelle connexion détectée depuis un ${isNewDevice ? 'nouvel appareil' : 'nouvel emplacement'}: ${info.device} (${info.location})`,
            link: '/settings'
          });

          // Also alert Admin if it's an admin login
          if (userData.role === 'ADMIN') {
            const auditLog: Omit<Notification, 'id' | 'timestamp' | 'read'> = {
              userId: 'LOGS', // Special key for system logs if we want
              senderId: uid,
              senderName: userData.name,
              type: 'ALERT',
              content: `Alerte Sécurité: Admin ${userData.name} s'est connecté depuis ${info.device} (${info.location})`,
              link: `/profile/${uid}`
            };
            // Notifications are currently our audit logs in this implementation
            await this.createNotification(auditLog);
          }
        } else {
          // Normal audit log for standard login
          await this.createNotification({
            userId: 'LOGS',
            senderId: uid,
            senderName: userData.name,
            type: 'LOGIN',
            content: `${userData.name} s'est connecté au système. Total connexions: ${loginCount}`,
            link: `/profile/${uid}`
          });
        }
      }
    } catch (error) {
       console.error('Failed to log login:', error);
    }
  },

  async deleteUser(uid: string): Promise<void> {
    // We no longer delete users to keep audit trails.
    // We ban them instead.
    await this.banUser(uid, true);
  },

  async banUser(uid: string, isBanned: boolean): Promise<void> {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), { 
        isBanned,
        status: isBanned ? 'offline' : 'online',
        updatedAt: serverTimestamp() 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Projects
  async getProjects(role: 'CLIENT' | 'TOPOGRAPHER' | 'ADMIN', uid: string): Promise<Project[]> {
    const path = 'projects';
    if (!uid && role !== 'ADMIN') {
      console.warn('getProjects called without uid for non-admin role');
      return [];
    }
    try {
      let q;
      if (role === 'ADMIN') {
        q = query(collection(db, 'projects'));
      } else if (role === 'TOPOGRAPHER') {
        q = query(collection(db, 'projects'), where('topographerId', '==', uid));
      } else {
        q = query(collection(db, 'projects'), where('clientId', '==', uid));
      }
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Project));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async createProject(project: Omit<Project, 'id'>): Promise<string> {
    const path = 'projects';
    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        name: project.name,
        description: project.description || '',
        status: project.status,
        progress: project.progress,
        currentStep: project.currentStep || 0,
        startDate: project.startDate || '',
        estimatedDelivery: project.estimatedDelivery || '',
        deadline: project.deadline,
        topographerId: project.topographerId,
        clientId: project.clientId,
        clientName: project.clientName,
        adminEmail: project.adminEmail || '',
        adminId: project.adminId || '',
        location: project.location || '',
        coordinates: project.coordinates || { lat: 0, lng: 0 },
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return '';
    }
  },

  async createDocument(document: Omit<ProjectDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const path = 'documents';
    try {
      const docRef = await addDoc(collection(db, 'documents'), {
        ...document,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isSigned: false
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  async updateProject(id: string, data: Partial<Project>): Promise<void> {
    const path = `projects/${id}`;
    if (!id) return;
    try {
      await updateDoc(doc(db, 'projects', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async updateDocument(id: string, data: Partial<ProjectDocument>): Promise<void> {
    const path = `documents/${id}`;
    if (!id) return;
    try {
      await updateDoc(doc(db, 'documents', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Helper to parse Google Maps URL to coordinates
  parseGoogleMapsUrl(url: string): { lat: number, lng: number, z?: number } | null {
    try {
      // Logic for format: https://www.google.com/maps/@33.5724128,-7.5891328,15z
      const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
      }
      
      // Logic for query format: https://www.google.com/maps/search/?api=1&query=33.5724128,-7.5891328
      const queryMatch = url.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (queryMatch) {
        return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };
      }

      return null;
    } catch (e) {
      console.error("Error parsing maps URL:", e);
      return null;
    }
  },

  // Calculate area of a polygon in square meters
  calculateArea(coords: { lat: number, lng: number }[]): number {
    if (coords.length < 3) return 0;
    let area = 0;
    const radius = 6378137; // Earth's radius in meters
    
    for (let i = 0; i < coords.length; i++) {
        const p1 = coords[i];
        const p2 = coords[(i + 1) % coords.length];
        area += (p2.lng - p1.lng) * (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
    }
    
    return Math.abs(area * radius * radius / 2 * Math.PI / 180);
  },

  // Calculate perimeter of a polyline/polygon in meters
  calculatePerimeter(coords: { lat: number, lng: number }[]): number {
    let perimeter = 0;
    const radius = 6378137;
    
    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      
      const dLat = (p2.lat - p1.lat) * Math.PI / 180;
      const dLng = (p2.lng - p1.lng) * Math.PI / 180;
      
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      perimeter += radius * c;
    }
    
    return perimeter;
  },

  async updateProjectProgress(id: string, progress: number): Promise<void> {
    const path = `projects/${id}`;
    if (!id) return;
    try {
      await updateDoc(doc(db, 'projects', id), { progress });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async updateProjectStatus(id: string, status: Project['status']): Promise<void> {
    const path = `projects/${id}`;
    if (!id) return;
    try {
      await updateDoc(doc(db, 'projects', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Documents
  async getDocuments(projectId: string): Promise<ProjectDocument[]> {
    const path = 'documents';
    if (!projectId) return [];
    try {
      const q = query(collection(db, 'documents'), where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as ProjectDocument));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToDocuments(userId: string, role: UserRole, callback: (docs: ProjectDocument[]) => void) {
    const path = 'documents';
    const field = role === 'CLIENT' ? 'clientId' : 'topographerId';
    const q = role === 'ADMIN'
      ? query(collection(db, 'documents'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'documents'), where(field, '==', userId), orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as ProjectDocument));
      callback(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  async getAllDocumentsByUser(userId: string, role: UserRole): Promise<ProjectDocument[]> {
    const path = 'documents';
    try {
      const field = role === 'CLIENT' ? 'clientId' : 'topographerId';
      const q = query(collection(db, 'documents'), where(field, '==', userId), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Fallback for older documents without clientId/topographerId
        // This might be what's currently failing if we use high-level listing without projectId filter
        return [];
      }
      
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as ProjectDocument));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async getAllDocuments(): Promise<ProjectDocument[]> {
    const path = 'documents';
    try {
      const q = query(collection(db, 'documents'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as ProjectDocument));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async getAllDocumentsForClient(projectIds: string[]): Promise<ProjectDocument[]> {
    if (projectIds.length === 0) return [];
    const path = 'documents';
    try {
      // Chunking for 'in' query if needed, but we prefer getAllDocumentsByUser
      const q = query(collection(db, 'documents'), where('projectId', 'in', projectIds.slice(0, 10)), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as ProjectDocument));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  // Get all unique topographers a client has messaged
  async getChatContacts(userId: string, role: 'CLIENT' | 'TOPOGRAPHER'): Promise<User[]> {
    try {
      const messagesRef = collection(db, 'messages');
      const q1 = query(messagesRef, where('senderId', '==', userId));
      const q2 = query(messagesRef, where('receiverId', '==', userId));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const contactIds = new Set<string>();
      snap1.docs.forEach(doc => contactIds.add(doc.data().receiverId));
      snap2.docs.forEach(doc => contactIds.add(doc.data().senderId));
      
      const contacts: User[] = [];
      for (const id of contactIds) {
        if (id && id !== userId) {
          const u = await this.getUser(id);
          if (u) contacts.push(u);
        }
      }
      return contacts;
    } catch (error) {
      console.error("Error getting contacts:", error);
      return [];
    }
  },

  async addProject(project: Omit<Project, 'id'>): Promise<string> {
    const path = 'projects';
    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        ...project,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return '';
    }
  },

  async addDocument(document: Omit<ProjectDocument, 'id'>): Promise<string> {
    const path = 'documents';
    try {
      let finalClientId = document.clientId;
      let finalTopographerId = document.topographerId;

      // If missing, fetch from project
      if (!finalClientId || !finalTopographerId) {
        const projectDoc = await getDoc(doc(db, 'projects', document.projectId));
        if (projectDoc.exists()) {
          const projectData = projectDoc.data() as Project;
          finalClientId = finalClientId || projectData.clientId;
          finalTopographerId = finalTopographerId || projectData.topographerId;
        }
      }

      const docRef = await addDoc(collection(db, 'documents'), {
        projectId: document.projectId,
        clientId: finalClientId || '',
        topographerId: finalTopographerId || '',
        name: document.name,
        type: document.type,
        url: document.url,
        size: document.size,
        amount: document.amount || null,
        metadata: document.metadata || null,
        createdAt: serverTimestamp()
      });

      // Notify the specific Admin linked to this topographer
      const topographer = await this.getUser(auth.currentUser?.uid || '');
      let adminUid = topographer?.adminId;

      if (!adminUid && topographer?.adminEmail) {
        const admin = await this.getAdminByEmail(topographer.adminEmail);
        adminUid = admin?.id;
      }

      if (adminUid) {
        await this.createNotification({
          userId: adminUid,
          senderId: auth.currentUser?.uid || '',
          senderName: 'Système',
          type: 'DOCUMENT',
          content: `Nouveau document déposé : ${document.name}`,
          link: `/projets/${document.projectId}`
        });
      }
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return '';
    }
  },

  // Messages
  subscribeToMessages(userId: string, otherId: string, callback: (messages: Message[]) => void) {
    const path = 'messages';
    const q = query(
      collection(db, 'messages'),
      or(
        and(where('senderId', '==', userId), where('receiverId', '==', otherId)),
        and(where('senderId', '==', otherId), where('receiverId', '==', userId))
      ),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Message));
      callback(msgs);
    }, (error) => {
      // It might fail if index is not ready
      if (error instanceof Error && error.message.includes('index')) {
        console.warn('Firestore index required for message sorting');
      }
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  async sendMessage(message: Message): Promise<void> {
    const path = 'messages';
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: message.senderId,
        receiverId: message.receiverId,
        text: message.text,
        fileUrl: message.fileUrl || null,
        fileName: message.fileName || null,
        fileType: message.fileType || null,
        timestamp: serverTimestamp(),
        deletedForEveryone: false,
        deletedBy: []
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async deleteMessageForMe(msgId: string, userId: string): Promise<void> {
    const path = `messages/${msgId}`;
    try {
      await updateDoc(doc(db, 'messages', msgId), {
        deletedBy: arrayUnion(userId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteMessageForEveryone(msgId: string): Promise<void> {
    const path = `messages/${msgId}`;
    try {
      await updateDoc(doc(db, 'messages', msgId), {
        deletedForEveryone: true,
        text: 'Ce message a été supprimé',
        fileUrl: null,
        fileName: null,
        fileType: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Notifications
  subscribeToNotifications(userId: string, callback: (notifications: Notification[]) => void) {
    const path = 'notifications';
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Notification));
      callback(notifs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  async logFailedLogin(email: string, reason: string): Promise<void> {
    try {
      await addDoc(collection(db, 'failed_logins'), {
        email,
        reason,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent
      });
    } catch (error) {
      console.error('Error logging failed login:', error);
    }
  },

  async addReview(review: Omit<Review, 'id' | 'createdAt'>): Promise<void> {
    try {
      await addDoc(collection(db, 'reviews'), {
        ...review,
        createdAt: serverTimestamp()
      });

      const topoRef = doc(db, 'users', review.topographerId);
      const topoSnap = await getDoc(topoRef);
      if (topoSnap.exists()) {
        const topoData = topoSnap.data() as User;
        const currentRating = topoData.rating || 0;
        const currentCount = topoData.reviewCount || 0;
        const newCount = currentCount + 1;
        const newRating = (currentRating * currentCount + review.rating) / newCount;

        await updateDoc(topoRef, {
          rating: newRating,
          reviewCount: newCount
        });
      }
    } catch (error) {
       console.error('Error adding review:', error);
    }
  },

  async getReviews(topographerId: string): Promise<any[]> {
    try {
      const q = query(collection(db, 'reviews'), where('topographerId', '==', topographerId), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
    } catch (error) {
      console.error('Error getting reviews:', error);
      return [];
    }
  },

  subscribeToReviews(topographerId: string, callback: (reviews: any[]) => void) {
    const q = query(
      collection(db, 'reviews'),
      where('topographerId', '==', topographerId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(reviews);
    }, (error) => {
      console.error("Reviews listener failed:", error);
    });
  },

  async createNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    const path = 'notifications';
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        senderAvatar: notification.senderAvatar || '',
        read: false,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async markNotificationAsRead(id: string): Promise<void> {
    const path = `notifications/${id}`;
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const path = 'notifications';
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      const batch = snapshot.docs.map(d => updateDoc(doc(db, 'notifications', d.id), { read: true }));
      await Promise.all(batch);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeToAllNotifications(callback: (notifications: Notification[]) => void) {
    const path = 'notifications';
    const q = query(
      collection(db, 'notifications'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Notification));
      callback(notifs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  async signDocument(docId: string, signatureBase64: string, userId: string): Promise<void> {
    const path = `documents/${docId}`;
    try {
      await updateDoc(doc(db, 'documents', docId), {
        isSigned: true,
        signatureBase64,
        signatureDate: serverTimestamp(),
        signedBy: userId,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Interventions
  subscribeToInterventions(role: UserRole, userId: string, callback: (interventions: Intervention[]) => void) {
    const path = 'interventions';
    const q = role === 'ADMIN' 
      ? query(collection(db, 'interventions'), orderBy('date', 'asc'))
      : role === 'TOPOGRAPHER'
        ? query(collection(db, 'interventions'), where('topographerId', '==', userId), orderBy('date', 'asc'))
        : query(collection(db, 'interventions'), where('clientId', '==', userId), orderBy('date', 'asc'));

    return onSnapshot(q, (snapshot) => {
      const ints = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Intervention));
      callback(ints);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  async createIntervention(intervention: Omit<Intervention, 'id'>): Promise<string> {
    const path = 'interventions';
    try {
      const docRef = await addDoc(collection(db, 'interventions'), {
        ...intervention,
        status: intervention.status || 'PLANNED',
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return '';
    }
  },

  async updateIntervention(id: string, data: Partial<Intervention>): Promise<void> {
    const path = `interventions/${id}`;
    if (!id) return;
    try {
      await updateDoc(doc(db, 'interventions', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async updateTwoFactor(userId: string, enabled: boolean): Promise<void> {
    const path = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), {
        isTwoFactorEnabled: enabled,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteIntervention(id: string): Promise<void> {
    const path = `interventions/${id}`;
    try {
      await deleteDoc(doc(db, 'interventions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Data Exportation
  exportToCSV(data: any[], filename: string) {
    if (data.length === 0) return;
    
    // Get headers from first object keys
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Add header row
    csvRows.push(headers.join(','));
    
    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header];
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },

  async exportProjectsToCSV(role: UserRole, userId: string) {
    const projects = await this.getProjects(role as any, userId);
    const exportData = projects.map(p => ({
      ID: p.id,
      Nom: p.name,
      Client: p.clientName,
      Status: p.status,
      Progression: `${p.progress}%`,
      Echeance: p.deadline,
      Surface: p.area ? `${p.area} m²` : '0',
      Perimetre: p.perimeter ? `${p.perimeter} m` : '0',
      Description: p.description
    }));
    
    this.exportToCSV(exportData, `projets_topo_${new Date().toISOString().split('T')[0]}.csv`);
  }
};
