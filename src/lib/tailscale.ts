interface TailscaleDevice {
  name: string;
  addresses: string[];
  connectedToControl: boolean;
}

export async function getOnlineStatus(token: string, deviceName: string): Promise<boolean> {
  const connectedDeviceList = await getDevices(token);
  return connectedDeviceList.some((connectedDevice) => connectedDevice.name === deviceName);
}

export async function getDevices(token: string): Promise<TailscaleDevice[]> {
  const response = await fetch("https://api.tailscale.com/api/v2/tailnet/-/devices", {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await response.json();
  return (data.devices as any[])
    .filter((device) => device.connectedToControl)
    .map((device) => ({
      name: device.name,
      addresses: device.addresses,
      connectedToControl: device.connectedToControl
    }));
}
