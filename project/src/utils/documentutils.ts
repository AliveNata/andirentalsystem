export const getDocumentsToShowByIdentityType = (identityType: string): string[] => {
  if (identityType === 'single') {
    return [
      'ktpFile', 'simFile', 'parentKtpFile', 'kkFile', 'workOrStudentIdFile',
      'housePhotoFile', 'ticketFile', 'ticketHotelFile', 'verificationVideoFile', 'optionalRequirementFile'
    ];
  } else if (identityType === 'married') {
    return [
      'ktpFile', 'simFile', 'spouseKtpFile', 'kkFile', 'workIdFile',
      'housePhotoFile', 'ticketFile', 'ticketHotelFile', 'verificationVideoFile', 'optionalRequirementFile'
    ];
  } else if (identityType === 'corporate') {
    return [
      'ktpFile', 'simFile', 'picKtpFile', 'picKkFile', 'companyNpwpFile',
      'companySiupFile', 'companyNibFile', 'companyPhotoFile',
      'ticketFile', 'ticketHotelFile', 'verificationVideoFile', 'optionalRequirementFile'
    ];
  } else if (identityType === 'foreigner') {
    return [
      'personalIdFile', 'passportFile', 'simFile', 'kitasKitapFile',
      'marriageDocFile', 'workIdFile', 'visaFile', 'housePhotoFile',
      'ticketFile', 'ticketHotelFile', 'verificationVideoFile', 'optionalRequirementFile'
    ];
  }
  return [];
};