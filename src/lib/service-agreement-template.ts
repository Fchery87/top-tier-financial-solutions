// NY GBL Article 28-BB Compliant Service Agreement Template
// This template complies with New York General Business Law Article 28-BB (Credit Services Business)
// and the federal Credit Repair Organizations Act (CROA)

export const NY_SERVICE_AGREEMENT_TEMPLATE = `
<div style="font-family: 'Times New Roman', Times, serif; max-width: 850px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #000; background: #fff;">

  <!-- Header -->
  <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px double #1a365d; padding-bottom: 20px;">
    <h1 style="font-size: 24px; font-weight: bold; color: #1a365d; margin: 0;">TOP TIER FINANCIAL SOLUTIONS</h1>
    <p style="font-size: 18px; margin: 10px 0 5px 0; font-weight: bold;">CREDIT SERVICES AGREEMENT</p>
    <p style="font-size: 12px; color: #555; margin: 0;">Pursuant to New York General Business Law Article 28-BB and the Credit Repair Organizations Act (15 U.S.C. § 1679)</p>
  </div>

  <!-- Agreement Date and Parties -->
  <div style="margin-bottom: 25px;">
    <p><strong>Agreement Date:</strong> {{date}}</p>
    <p><strong>Agreement Number:</strong> {{agreement_number}}</p>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 30px; gap: 40px;">
    <div style="flex: 1;">
      <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;">CREDIT SERVICES ORGANIZATION:</h3>
      <p style="margin: 3px 0;"><strong>Top Tier Financial Solutions</strong></p>
      <p style="margin: 3px 0;">{{company_address}}</p>
      <p style="margin: 3px 0;">Email: info@TopTierFinancialSolutions.com</p>
      <p style="margin: 3px 0;">Phone: {{company_phone}}</p>
    </div>
    <div style="flex: 1;">
      <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;">CLIENT:</h3>
      <p style="margin: 3px 0;"><strong>{{client_name}}</strong></p>
      <p style="margin: 3px 0;">{{client_address}}</p>
      <p style="margin: 3px 0;">Email: {{client_email}}</p>
      <p style="margin: 3px 0;">Phone: {{client_phone}}</p>
      <p style="margin: 3px 0;">Date of Birth: {{client_dob}}</p>
      <p style="margin: 3px 0;">SSN (Last 4): XXX-XX-{{client_ssn_last4}}</p>
    </div>
  </div>

  <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />

  <!-- CROA Required Consumer Rights Notice - MUST BE FIRST -->
  <div style="background: #f8f9fa; border: 2px solid #1a365d; padding: 20px; margin-bottom: 25px;">
    <h2 style="text-align: center; color: #1a365d; margin-top: 0; font-size: 16px; text-transform: uppercase;">CONSUMER CREDIT FILE RIGHTS UNDER STATE AND FEDERAL LAW</h2>
    <p style="font-size: 11px; text-align: justify;">You have a right to dispute inaccurate information in your credit report by contacting the credit bureau directly. However, you are not required to purchase any goods or services in order to exercise this right or any other right described in this statement. You have a right to obtain a free copy of your credit report from a credit bureau once every twelve months. You may also be entitled to a free credit report if: (1) you have been denied credit, employment or insurance within the past 60 days as a result of your credit report; (2) you are unemployed and plan to seek employment within 60 days; (3) you are a recipient of public welfare assistance; or (4) you have reason to believe that your file at the credit bureau contains inaccurate information due to fraud.</p>
    
    <p style="font-size: 11px; text-align: justify; margin-top: 10px;">You have a right to obtain a copy of your credit report, either free or at a nominal cost, before you sign any agreement with a credit repair organization. A credit repair organization is prohibited by law from receiving payment until any promised services have been performed.</p>
    
    <p style="font-size: 11px; text-align: justify; margin-top: 10px;"><strong>You may cancel this contract without penalty or obligation at any time before midnight of the 3rd business day after the date on which you signed the contract.</strong></p>
    
    <p style="font-size: 11px; text-align: justify; margin-top: 10px;">Credit bureaus are required to follow reasonable procedures to ensure that the information they report is accurate. However, mistakes may occur. You may, on your own, notify a credit bureau in writing that you dispute the accuracy of the information in your credit file. The credit bureau must then reinvestigate and modify or remove inaccurate or incomplete information. The credit bureau may not charge any fee for this service. Any pertinent information and copies of all documents you have concerning an error should be given to the credit bureau.</p>
    
    <p style="font-size: 11px; text-align: justify; margin-top: 10px;">If the credit bureau's reinvestigation does not resolve the dispute to your satisfaction, you may send a brief statement to the credit bureau, to be kept in your file, explaining why you think the record is inaccurate. The credit bureau must include a summary of your statement about disputed information with any report it issues about you.</p>
    
    <p style="font-size: 11px; text-align: justify; margin-top: 10px;">The Federal Trade Commission regulates credit bureaus and credit repair organizations. For more information contact: <strong>Federal Trade Commission, Washington, D.C. 20580</strong> or <strong>Consumer Financial Protection Bureau, P.O. Box 4503, Iowa City, Iowa 52244</strong>.</p>
  </div>

  <!-- Article 1: Services -->
  <h2 style="color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 5px; font-size: 14px;">ARTICLE 1: DESCRIPTION OF SERVICES</h2>
  
  <p style="text-align: justify;">Top Tier Financial Solutions ("Company") agrees to perform the following credit services for the Client ("You"):</p>
  
  <ol style="padding-left: 20px;">
    <li style="margin-bottom: 10px;"><strong>Credit Report Analysis:</strong> Comprehensive review and analysis of your credit reports from all three major credit bureaus (Equifax, Experian, and TransUnion) to identify potentially inaccurate, incomplete, misleading, or unverifiable information.</li>
    
    <li style="margin-bottom: 10px;"><strong>Dispute Preparation and Submission:</strong> Preparation and submission of dispute letters to credit bureaus and/or creditors/furnishers challenging items identified as potentially inaccurate, incomplete, or unverifiable, pursuant to the Fair Credit Reporting Act, Fair Debt Collection Practices Act, Fair and Accurate Credit Transactions Act, and Fair Credit Billing Act.</li>
    
    <li style="margin-bottom: 10px;"><strong>Follow-up Services:</strong> Follow-up on disputes every 35 days, not to exceed 40 days, including review of bureau responses and preparation of additional dispute rounds as necessary.</li>
    
    <li style="margin-bottom: 10px;"><strong>Progress Tracking:</strong> Online access to track your case progress and view all resolved items at www.TopTierFinancialSolutions.com portal.</li>
    
    <li style="margin-bottom: 10px;"><strong>Client Support:</strong> Access to client services staff Monday through Friday, 9:00 AM to 6:00 PM Eastern Standard Time for questions regarding your account.</li>
  </ol>

  <!-- Adverse Items Section (Required by NY GBL 458-f) -->
  <div style="background: #fff8e1; border: 1px solid #ffc107; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #856404; font-size: 13px;">SPECIFIC ADVERSE INFORMATION TO BE ADDRESSED</h3>
    <p style="font-size: 11px; color: #856404; margin-bottom: 10px;">(As required by New York General Business Law § 458-f - A copy of your current credit report highlighting adverse entries is attached hereto as Exhibit B)</p>
    <div id="adverse-items-placeholder" style="min-height: 100px; border: 1px dashed #ccc; padding: 10px; background: #fff;">
      {{adverse_items_list}}
    </div>
  </div>

  <!-- Article 2: Timeline -->
  <h2 style="color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 5px; font-size: 14px;">ARTICLE 2: ESTIMATED TIMELINE</h2>
  
  <p style="text-align: justify;">The credit repair process typically takes 3-6 months depending on the complexity of your credit file. Each dispute cycle takes approximately 30-45 days. Results vary on a case-by-case basis, and the Company cannot guarantee specific outcomes or timeframes as only Credit Reporting Agencies have control over the ultimate results.</p>
  
  <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px;">
    <tr style="background: #f0f0f0;">
      <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Phase</th>
      <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Estimated Duration</th>
      <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Activities</th>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 10px;">Initial Review</td>
      <td style="border: 1px solid #ccc; padding: 10px;">5-7 Business Days</td>
      <td style="border: 1px solid #ccc; padding: 10px;">Credit report analysis and dispute strategy development</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 10px;">Round 1 Disputes</td>
      <td style="border: 1px solid #ccc; padding: 10px;">30-45 Days</td>
      <td style="border: 1px solid #ccc; padding: 10px;">Initial dispute letters sent to credit bureaus</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 10px;">Subsequent Rounds</td>
      <td style="border: 1px solid #ccc; padding: 10px;">35-40 Days Each</td>
      <td style="border: 1px solid #ccc; padding: 10px;">Follow-up disputes based on bureau responses</td>
    </tr>
  </table>

  <!-- Article 3: Term and Contract Duration -->
  <h2 style="color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 5px; font-size: 14px;">ARTICLE 3: TERM AND TERMINATION</h2>
  
  <p style="text-align: justify;">This Agreement shall be effective for a period of <strong>six (6) months</strong> from the date of execution, commencing upon receipt of your initial credit reports by the Company. Either party may cancel this Agreement at any time with thirty (30) days written notice. Notice shall not be considered received unless all parties have received confirmation of receipt.</p>

  <!-- Article 4: Fees - REQUIRED 10-POINT TYPE NOTICE -->
  <h2 style="color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 5px; font-size: 14px;">ARTICLE 4: FEES AND PAYMENT</h2>
  
  <div style="background: #d4edda; border: 2px solid #28a745; padding: 20px; margin: 15px 0;">
    <p style="font-size: 12pt; font-weight: bold; margin: 0; text-align: center; color: #155724;">
      IMPORTANT FEE DISCLOSURE (Required by NY GBL § 458-f)
    </p>
    <p style="font-size: 10pt; margin: 15px 0 0 0; text-align: center; color: #155724;">
      NO FEES MAY BE COLLECTED BY THE CREDIT SERVICES ORGANIZATION UNTIL THE SERVICES HAVE BEEN FULLY PERFORMED. YOU WILL NOT BE CHARGED ANY FEE UNTIL AFTER SERVICES ARE RENDERED.
    </p>
  </div>

  <p style="text-align: justify;">Payment terms and fees are set forth in <strong>Exhibit A - Payment Schedule</strong>, which is incorporated into this Agreement. Fees are charged only after services have been performed in compliance with the Credit Repair Organizations Act (15 U.S.C. § 1679b(b)).</p>

  <p style="text-align: justify;"><strong>NO CASH PAYMENTS WILL EVER BE ACCEPTED.</strong></p>

  <!-- Article 5: Client Responsibilities (Initialed Disclosures) -->
  <h2 style="color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 5px; font-size: 14px;">ARTICLE 5: CLIENT RESPONSIBILITIES AND ACKNOWLEDGMENTS</h2>
  
  <p style="text-align: justify;">By initialing each item below, Client acknowledges and agrees to the following:</p>

  <div class="initials-section" style="margin: 20px 0;">
    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_documents" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_documents}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>A.</strong> Client will provide a copy of their valid driver's license (with current address), Social Security card, and a recent utility bill (phone, gas, or electric) showing the correct address.</p>
    </div>

    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_credit_reports" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_credit_reports}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>B.</strong> Client agrees to obtain initial credit reports with scores from all three credit bureaus (Equifax, Experian, and TransUnion) and understands that Company will not proceed until credit reports are received. Client also agrees to maintain a credit monitoring subscription for the duration of this contract. <strong>Both obtaining initial reports and maintaining credit monitoring are NON-NEGOTIABLE requirements.</strong></p>
    </div>

    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_payments" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_payments}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>C.</strong> Client agrees to maintain on-time monthly payments of their current credit obligations (car loans, utility bills, mortgage payments, credit cards, etc.). <strong>Failure to maintain those payments will result in severe damage to progress and will forfeit any warranties. The addition of any new negative item to the credit file shall void any and all warranties.</strong></p>
    </div>

    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_contact" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_contact}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>D.</strong> Client agrees to contact Top Tier Financial Solutions regarding any questions about their credit INCLUDING inquiries or questions regarding applying for new consumer credit.</p>
    </div>

    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_referral" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_referral}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>E.</strong> If Client was referred by a referral partner, Client hereby expressly consents to Top Tier Financial Solutions sharing data concerning the progress of the credit restoration process with the aforementioned referral partner.</p>
    </div>

    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_fee_terms" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_fee_terms}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>F.</strong> Client agrees to payment terms and conditions as set forth in Exhibit A, which is incorporated into this Agreement.</p>
    </div>

    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_warranty" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_warranty}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>G.</strong> Company warranty shall be understood as follows: Top Tier Financial Solutions guarantees client satisfaction. Any client unhappy with their results can request a refund for the current month's credit restoration services being processed.</p>
    </div>

    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_refund" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_refund}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>H.</strong> If Client fails to complete the payment schedule, any and all refunds are forfeited. Warranty shall be considered satisfied.</p>
    </div>

    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_binding" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_binding}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>I.</strong> Client understands this is a binding agreement and failure to make arranged monthly payments can result in negative activity to Client's credit file.</p>
    </div>

    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_results" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_results}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>J.</strong> Client understands that results vary on a case-by-case basis and that Top Tier Financial Solutions provides a service and has no control over removal of negative items on the credit report. Only Credit Agencies have control over results.</p>
    </div>

    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_term" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_term}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>K.</strong> Contract is for 6 months from the start date based upon initial credit reports being received. Either party may cancel at any time with 30 days written notice. Notice is not considered received unless all parties confirm receipt.</p>
    </div>

    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #fff3cd; border-radius: 5px; border: 1px solid #ffc107;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_cancel" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_cancel}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>L.</strong> <strong>RIGHT TO CANCEL:</strong> You may cancel this contract without penalty or obligation at any time before midnight of the 3rd business day after the date on which you signed this Agreement. To cancel, complete and mail or deliver the attached Notice of Cancellation form.</p>
    </div>

    <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
      <div style="min-width: 80px; margin-right: 15px;">
        <div class="initial-box" data-field="initial_login" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_login}}</div>
      </div>
      <p style="margin: 0; font-size: 12px;"><strong>M.</strong> Client agrees to provide working login credentials for their credit monitoring service each month to enable Company to track changes in the credit file due to the dispute process.</p>
    </div>
  </div>

  <!-- Article 6: NY-Specific Disclosures -->
  <h2 style="color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 5px; font-size: 14px;">ARTICLE 6: NEW YORK STATE DISCLOSURES</h2>
  
  <div style="background: #e8f4fd; border: 1px solid #0077b6; padding: 15px; margin: 15px 0;">
    <h3 style="margin-top: 0; font-size: 12px; color: #0077b6;">INCORRECT INFORMATION</h3>
    <p style="font-size: 11px; text-align: justify; margin-bottom: 15px;">"Consumer reporting agencies are required to follow reasonable procedures to ensure that subscribing creditors report information accurately. However, mistakes may occur. When you notify the consumer reporting agency in writing that you dispute the accuracy of the information, it must reinvestigate and modify or remove inaccurate data. The consumer reporting agency may not charge any fee for this service. Any pertinent data you have concerning an error should be given to the consumer reporting agency. If a reinvestigation does not resolve the dispute to your satisfaction, you may enter a statement of one hundred words or less in your file, explaining why you think the record is inaccurate. The consumer reporting agency must include your statement about disputed data -- or a coded version of it -- with any reports it issues about you. <strong>New York law also provides that, at your request, the consumer reporting agency must notify any person who has received a report in the previous year that an error existed and furnish such person with the corrected information.</strong>"</p>

    <h3 style="font-size: 12px; color: #0077b6;">TIME LIMITS ON ADVERSE DATA</h3>
    <p style="font-size: 11px; text-align: justify; margin-bottom: 15px;">"Most kinds of information in your file may be reported for a period of seven years. If you have declared personal bankruptcy, however, that fact may be reported for ten years. After seven years or ten years, the information can't be disclosed by a credit reporting agency unless you are being investigated for a credit application of $50,000 or more, for an application to purchase life insurance of $50,000 or more, or for employment at an annual salary of $25,000 or more."</p>

    <h3 style="font-size: 12px; color: #0077b6;">OBTAINING YOUR CREDIT REPORT</h3>
    <p style="font-size: 11px; text-align: justify;">"If at any time you wish to review your credit file, you may obtain information from a credit bureau. The credit bureau may charge you a small fee. There is no fee, however, if you have been turned down for credit, employment, or insurance because of information contained in a report within the preceding thirty days."</p>
  </div>

  <!-- Article 7: Warranty Policy -->
  <h2 style="color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 5px; font-size: 14px;">ARTICLE 7: WARRANTY AND REFUND POLICY</h2>
  
  <p style="text-align: justify;">Company makes no warranties aside from those expressly written in this Agreement. No oral agreement shall override this Agreement unless received in writing from an authorized representative.</p>

  <ul style="font-size: 12px;">
    <li>Failure to maintain consistent monthly payments voids all warranties.</li>
    <li>Addition of any new negative item to the credit file voids all warranties.</li>
    <li>If Client misses a payment or has a payment returned for NSF, all warranties are void.</li>
    <li>Warranty is considered satisfied if Client's credit improves during 6 months of service.</li>
    <li>Failure to complete the payment schedule forfeits all refunds.</li>
  </ul>

  <!-- Article 8: Miscellaneous -->
  <h2 style="color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 5px; font-size: 14px;">ARTICLE 8: MISCELLANEOUS PROVISIONS</h2>
  
  <p style="text-align: justify; font-size: 12px;"><strong>Indemnification:</strong> Client shall indemnify and hold Company free and harmless from any and all claims, damages or lawsuits (including reasonable attorneys' fees) arising out of negligence or malfeasant acts of Client.</p>
  
  <p style="text-align: justify; font-size: 12px;"><strong>Force Majeure:</strong> Under no circumstances shall Company be responsible for failure or delay in performing services when such failure or delay is due to strike, accident, labor trouble, acts of nature, war, civil disturbance, vendor problems, or any cause beyond Company's reasonable control.</p>
  
  <p style="text-align: justify; font-size: 12px;"><strong>Affiliate Providers:</strong> Company has the option of fulfilling credit services through a credit services processor or affiliate to best serve you.</p>
  
  <p style="text-align: justify; font-size: 12px;"><strong>Confidentiality:</strong> Client agrees to keep all communications, dispute strategies, and proprietary methods confidential and not to disclose to any third parties or use to compete with the Company's services.</p>

  <p style="text-align: justify; font-size: 12px;"><strong>Governing Law:</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of New York and applicable federal law.</p>

  <p style="text-align: justify; font-size: 12px;"><strong>Entire Agreement:</strong> This Agreement, together with all Exhibits attached hereto, constitutes the entire agreement between the parties and supersedes all prior agreements and understandings.</p>

  <!-- Signature Section -->
  <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #1a365d;">
    <h2 style="text-align: center; color: #1a365d; font-size: 14px;">SIGNATURES</h2>
    
    <p style="font-size: 11px; text-align: center; margin-bottom: 20px;">By signing below, both parties acknowledge they have read, understand, and agree to all terms and conditions of this Agreement.</p>

    <div style="display: flex; justify-content: space-between; gap: 40px; margin-top: 30px;">
      <div style="flex: 1;">
        <p style="border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 5px; min-height: 40px;">
          <strong>Client Signature:</strong><br/>
          <span id="client-signature-placeholder">{{client_signature}}</span>
        </p>
        <p style="font-size: 11px;">Name: {{client_name}}</p>
        <p style="font-size: 11px;">Date: {{signature_date}}</p>
      </div>
      <div style="flex: 1;">
        <p style="border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 5px; min-height: 40px;">
          <strong>Company Representative:</strong>
        </p>
        <p style="font-size: 11px;">Top Tier Financial Solutions</p>
        <p style="font-size: 11px;">Date: {{date}}</p>
      </div>
    </div>
  </div>

  <!-- ESIGN Notice -->
  <div style="margin-top: 30px; padding: 15px; background: #f5f5f5; border-radius: 5px; font-size: 10px; text-align: center;">
    <p style="margin: 0;">*** In accordance with the U.S. Electronic Signatures in Global and National Commerce (ESIGN) Act of 2000, electronic records and signatures are legally binding, having the same legal effects as traditional paper documents and handwritten signatures. For more information, visit: <a href="https://www.ftc.gov/tips-advice/business-center/guidance/electronic-signatures-global-national-commerce-act" target="_blank">FTC ESIGN Information</a> ***</p>
  </div>

  <!-- Page Break for Exhibits -->
  <div style="page-break-before: always;"></div>

  <!-- Exhibit A: Payment Schedule -->
  <div style="margin-top: 40px;">
    <h2 style="text-align: center; color: #1a365d; border: 2px solid #1a365d; padding: 10px; font-size: 16px;">EXHIBIT A - PAYMENT SCHEDULE</h2>
    
    <div style="margin-top: 20px;">
      <h3 style="font-size: 13px;">Selected Service Package:</h3>
      <div id="service-package-placeholder" style="padding: 15px; background: #f9f9f9; border: 1px solid #ccc; border-radius: 5px; margin-bottom: 20px;">
        {{service_package}}
      </div>

      <h3 style="font-size: 13px;">Payment Authorization:</h3>
      <div style="padding: 15px; background: #f9f9f9; border: 1px solid #ccc; border-radius: 5px;">
        <p style="font-size: 12px; margin-bottom: 10px;"><strong>Payment Method:</strong> {{payment_method}}</p>
        <p style="font-size: 12px; margin-bottom: 10px;"><strong>Bank Name:</strong> {{bank_name}}</p>
        <p style="font-size: 12px; margin-bottom: 10px;"><strong>Routing Number:</strong> {{routing_number}}</p>
        <p style="font-size: 12px; margin-bottom: 10px;"><strong>Account Number (Last 4):</strong> XXXX{{account_last4}}</p>
        <p style="font-size: 12px; margin-bottom: 0;"><strong>Billing Date:</strong> {{billing_date}} of each month</p>
      </div>

      <div style="margin-top: 20px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px;">
        <p style="font-size: 11px; margin: 0; text-align: center;"><strong>I have read the above and understand the terms of this payment agreement.</strong></p>
        <div style="text-align: center; margin-top: 10px;">
          <div class="initial-box" data-field="initial_payment_auth" style="width: 60px; height: 30px; border: 2px solid #1a365d; display: inline-block; text-align: center; line-height: 26px; font-weight: bold; cursor: pointer;">{{initial_payment_auth}}</div>
          <span style="font-size: 11px; margin-left: 10px;">(Initials)</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Page Break -->
  <div style="page-break-before: always;"></div>

  <!-- Notice of Cancellation (REQUIRED - Detachable) -->
  <div style="border: 3px dashed #dc3545; padding: 30px; margin-top: 40px; background: #fff5f5;">
    <h2 style="text-align: center; color: #dc3545; font-size: 18px; margin-top: 0; text-transform: uppercase;">NOTICE OF CANCELLATION</h2>
    <p style="text-align: center; font-size: 11px; color: #666;">(Detach and return this form ONLY if you wish to cancel this Agreement)</p>
    
    <hr style="border: 1px dashed #dc3545; margin: 20px 0;" />
    
    <p style="font-size: 12px;"><strong>To:</strong> Top Tier Financial Solutions</p>
    <p style="font-size: 12px;">{{company_address}}</p>
    <p style="font-size: 12px;">Email: info@TopTierFinancialSolutions.com</p>
    
    <div style="margin: 30px 0; padding: 20px; background: #fff; border: 1px solid #ccc;">
      <p style="font-size: 12px; margin-bottom: 15px;">I hereby cancel the Credit Services Agreement dated <strong>{{date}}</strong>.</p>
      
      <p style="font-size: 12px; margin-bottom: 10px;"><strong>Agreement Number:</strong> {{agreement_number}}</p>
      
      <p style="font-size: 12px; margin-bottom: 15px;"><strong>Client Name:</strong> {{client_name}}</p>
      
      <p style="font-size: 12px; margin-bottom: 5px;"><strong>Client Signature:</strong></p>
      <div style="border-bottom: 1px solid #000; height: 40px; margin-bottom: 15px;"></div>
      
      <p style="font-size: 12px; margin-bottom: 5px;"><strong>Date of Cancellation:</strong></p>
      <div style="border-bottom: 1px solid #000; height: 25px; width: 200px;"></div>
    </div>
    
    <div style="background: #fff3cd; padding: 15px; border: 1px solid #ffc107; border-radius: 5px; margin-top: 20px;">
      <p style="font-size: 11px; margin: 0; text-align: center;">
        <strong>IMPORTANT:</strong> You may cancel this contract without penalty or obligation within <strong>THREE (3) BUSINESS DAYS</strong> from the date you signed it. To cancel, you must send this notice by mail, email, or hand delivery so that it is received by midnight of the third business day.
      </p>
    </div>
    
    <p style="font-size: 10px; text-align: center; margin-top: 20px; color: #666;">
      Cancellation Deadline: <strong>{{cancellation_deadline}}</strong>
    </p>
  </div>

</div>
`;

// Information Statement required before contract signing (NY GBL 458-d)
export const NY_INFORMATION_STATEMENT = `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 30px; line-height: 1.6;">
  <h1 style="text-align: center; color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 10px;">
    CONSUMER INFORMATION STATEMENT
  </h1>
  <h2 style="text-align: center; font-size: 14px; color: #666; margin-top: 5px;">
    Required by New York General Business Law § 458-d
  </h2>

  <div style="background: #f8f9fa; border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 5px;">
    <h3 style="color: #1a365d; margin-top: 0;">YOUR RIGHTS UNDER NEW YORK AND FEDERAL LAW</h3>
    
    <p><strong>1. RIGHT TO DISPUTE DIRECTLY:</strong> You have the right to dispute inaccurate information in your credit report by contacting the credit bureau directly, without charge.</p>
    
    <p><strong>2. FREE ANNUAL CREDIT REPORT:</strong> You are entitled to receive a free copy of your credit report once every 12 months from each of the three major credit bureaus at <a href="https://www.annualcreditreport.com">www.annualcreditreport.com</a>.</p>
    
    <p><strong>3. NO ADVANCE FEES:</strong> Under New York law and federal law, credit repair organizations are prohibited from charging any fees until after services have been fully performed.</p>
    
    <p><strong>4. RIGHT TO CANCEL:</strong> You have the absolute right to cancel any contract with a credit repair organization within 3 business days of signing, without penalty or obligation.</p>
    
    <p><strong>5. WRITTEN CONTRACT REQUIRED:</strong> You are entitled to receive a written contract specifying all services to be performed, the total cost, and the timeframe for completion.</p>
    
    <p><strong>6. NO GUARANTEES:</strong> No credit repair organization can legally guarantee specific results. Any company that guarantees to remove accurate negative information from your credit report is not being truthful.</p>
  </div>

  <div style="border: 2px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 5px;">
    <h3 style="color: #dc3545; margin-top: 0; text-align: center;">IMPORTANT WARNING</h3>
    <p style="text-align: center; font-weight: bold;">You have the right to take the following actions yourself, without paying a credit repair company:</p>
    <ul>
      <li>Obtain your credit report</li>
      <li>Dispute inaccurate information</li>
      <li>Add a consumer statement to your file</li>
      <li>Request creditors to update information</li>
    </ul>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc;">
    <p style="font-size: 12px;"><strong>I acknowledge that I have received and read this Consumer Information Statement BEFORE signing any contract with Top Tier Financial Solutions.</strong></p>
    
    <div style="display: flex; justify-content: space-between; margin-top: 30px;">
      <div>
        <p>Client Signature: _________________________</p>
        <p>Print Name: {{client_name}}</p>
      </div>
      <div>
        <p>Date: {{date}}</p>
      </div>
    </div>
  </div>
</div>
`;

export const DISCLOSURE_TEXTS = {
  right_to_cancel: 'You have the right to cancel this contract within 3 business days from the date you signed it. To cancel, you must notify Top Tier Financial Solutions in writing. See the attached Notice of Cancellation form.',
  no_guarantee: 'No credit repair organization can guarantee specific results. Top Tier Financial Solutions cannot guarantee that any particular item will be removed from your credit report. Results vary based on individual circumstances.',
  credit_bureau_rights: 'You have the right to dispute inaccurate information in your credit report directly with the credit bureaus at no charge. You do not need to pay anyone to exercise this right.',
  written_contract: 'You are entitled to a written contract specifying the services to be performed, the total cost, and the estimated completion time before any services begin.',
  fee_disclosure: 'Under federal law (Credit Repair Organizations Act) and New York law (GBL Article 28-BB), no fees may be charged until services have been fully performed. You will not be charged any fee in advance of services being rendered.',
  ny_adverse_data: 'Under New York law, most adverse information may be reported for 7 years. Bankruptcy may be reported for 10 years. You have the right to add a 100-word statement disputing any information in your file.',
  information_statement: 'I acknowledge that I have received and read the Consumer Information Statement as required by New York General Business Law § 458-d BEFORE signing this Agreement.',
};

export const REQUIRED_DISCLOSURES_NY = [
  'right_to_cancel',
  'no_guarantee', 
  'credit_bureau_rights',
  'written_contract',
  'fee_disclosure',
  'ny_adverse_data',
  'information_statement',
];
