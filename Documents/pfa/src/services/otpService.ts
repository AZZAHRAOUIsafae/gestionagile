
export const otpService = {
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  async sendOTP(email: string, code: string): Promise<void> {
    console.log(`[SIMULATED EMAIL] To: ${email} | Body: Votre code de vérification est ${code}`);
    // We can also create a global "System" notification for the user to see in their dashboard if they were logged in, 
    // but since they are logging in, we'll just stick to the console and maybe a UI hint.
  }
};
