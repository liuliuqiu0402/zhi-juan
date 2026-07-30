import Capacitor
import Foundation

/// 读取 iOS 签名证书到期时间
/// 从 App Bundle 中的 embedded.mobileprovision 提取 ExpirationDate
@objc(AppSignaturePlugin)
public class AppSignaturePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppSignaturePlugin"
    public let jsName = "AppSignature"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getExpiration", returnType: CAPPluginReturnPromise)
    ]

    @objc func getExpiration(_ call: CAPPluginCall) {
        // 1. 查找 embedded.mobileprovision
        guard let profilePath = Bundle.main.path(forResource: "embedded", ofType: "mobileprovision") else {
            call.resolve([
                "expirationDate": NSNull(),
                "expirationTimestamp": 0,
                "daysRemaining": -1,
                "found": false
            ])
            return
        }

        // 2. 读取文件内容
        guard let profileData = try? Data(contentsOf: URL(fileURLWithPath: profilePath)),
              let profileString = String(data: profileData, encoding: .ascii) else {
            call.resolve([
                "expirationDate": NSNull(),
                "expirationTimestamp": 0,
                "daysRemaining": -1,
                "found": true
            ])
            return
        }

        // 3. 从 CMS 签名数据中提取 plist（位于 <?xml ... </plist> 之间）
        guard let plistStart = profileString.range(of: "<?xml"),
              let plistEnd = profileString.range(of: "</plist>", options: .backwards) else {
            call.resolve([
                "expirationDate": NSNull(),
                "expirationTimestamp": 0,
                "daysRemaining": -1,
                "found": true
            ])
            return
        }

        let plistString = String(profileString[plistStart.lowerBound..<plistEnd.upperBound])
        guard let plistData = plistString.data(using: .utf8),
              let plist = try? PropertyListSerialization.propertyList(
                from: plistData, options: [], format: nil
              ) as? [String: Any],
              let expirationDate = plist["ExpirationDate"] as? Date else {
            call.resolve([
                "expirationDate": NSNull(),
                "expirationTimestamp": 0,
                "daysRemaining": -1,
                "found": true
            ])
            return
        }

        // 4. 计算剩余天数并返回
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current

        let daysRemaining = Calendar.current.dateComponents(
            [.day], from: Date(), to: expirationDate
        ).day ?? 0

        call.resolve([
            "expirationDate": formatter.string(from: expirationDate),
            "expirationTimestamp": Int64(expirationDate.timeIntervalSince1970 * 1000),
            "daysRemaining": max(0, daysRemaining),
            "found": true
        ])
    }
}
