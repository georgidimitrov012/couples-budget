const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetToken = jest.fn();
const mockSetChannel = jest.fn();
const mockFrom = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
let mockIsDevice = true;

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: (...a: unknown[]) => mockGetPermissions(...a),
  requestPermissionsAsync: (...a: unknown[]) => mockRequestPermissions(...a),
  setNotificationChannelAsync: (...a: unknown[]) => mockSetChannel(...a),
  getExpoPushTokenAsync: (...a: unknown[]) => mockGetToken(...a),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock('expo-device', () => ({
  get isDevice() {
    return mockIsDevice;
  },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } } },
}));
jest.mock('../../lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));

import { registerPushToken } from '../../hooks/usePushRegistration';

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDevice = true;
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  mockGetToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  mockFrom.mockReturnValue({ update: mockUpdate });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockEq.mockResolvedValue({ error: null });
});

describe('registerPushToken', () => {
  it('saves the token to the profile when permission is already granted', async () => {
    const token = await registerPushToken('u1');
    expect(token).toBe('ExponentPushToken[abc]');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalledWith({ push_token: 'ExponentPushToken[abc]' });
    expect(mockEq).toHaveBeenCalledWith('id', 'u1');
  });

  it('requests permission when undetermined, then saves', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
    const token = await registerPushToken('u1');
    expect(mockRequestPermissions).toHaveBeenCalled();
    expect(token).toBe('ExponentPushToken[abc]');
  });

  it('does nothing when permission is denied (and does not nag)', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    const token = await registerPushToken('u1');
    expect(token).toBeNull();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('is a no-op on a simulator (no physical device)', async () => {
    mockIsDevice = false;
    const token = await registerPushToken('u1');
    expect(token).toBeNull();
    expect(mockGetPermissions).not.toHaveBeenCalled();
  });

  it('never throws — a token failure just leaves push off', async () => {
    mockGetToken.mockRejectedValue(new Error('network'));
    await expect(registerPushToken('u1')).resolves.toBeNull();
  });
});
