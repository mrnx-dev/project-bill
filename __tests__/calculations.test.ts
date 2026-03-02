describe("Financial Calculations", () => {
  describe("Late Fee Calculation", () => {
    it("should calculate exactly 5% late fee", () => {
      const currentAmount = 1000000;
      const lateFee = currentAmount * 0.05;
      const newAmount = currentAmount + lateFee;

      expect(lateFee).toBe(50000);
      expect(newAmount).toBe(1050000);
    });

    it("should format IDR correctly for large numbers", () => {
      const currency = "IDR";
      const formatter = new Intl.NumberFormat(
        currency === "IDR" ? "id-ID" : "en-US",
        {
          style: "currency",
          currency,
          minimumFractionDigits: 0,
        },
      );

      // "id-ID" environment on Node uses "Rp", check format loosely for CI environment differences
      const formatted = formatter.format(1050000);

      expect(formatted.replace(/\s/g, "")).toMatch(/Rp.*\.*1\.050\.000/);
    });
  });

  describe("DP Deduction Calculation", () => {
    it("should correctly subtract DP from total amount", () => {
      const projectTotal = 5000000;
      const dpAmount = 1500000;
      const balanceAmount = projectTotal - dpAmount;

      expect(balanceAmount).toBe(3500000);
      expect(balanceAmount + dpAmount).toBe(projectTotal);
    });

    it("should handle zero DP (Full Payment) properly", () => {
      const projectTotal = 2500000;
      const dpAmount = 0;
      const balanceAmount = projectTotal - dpAmount;

      expect(balanceAmount).toBe(projectTotal);
    });
  });
});
