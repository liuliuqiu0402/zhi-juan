import Capacitor
import Foundation

/// 读取 iOS 签名证书到期时间
/// 从 App Bundle 中的 embedded.mobileprovision 提取 ExpirationDate
/// 用于在设置页展示签名剩余天数

// MARK: - AppSignaturePlugin (ad-hoc sign trigger)
@objc(AppSignaturePlugin)
public class AppSignaturePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppSignaturePlugin"
    public let jsName = "AppSignature"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getExpiration", returnType: CAPPluginReturnPromise)
    ]

    @objc func getExpiration(_ call: CAPPluginCall) {
        // 1. 查找 embedded.mobileprovision（多种路径策略）
        var profilePath: String?
        
        // 策略 A: Bundle.path(forResource:)
        profilePath = Bundle.main.path(forResource: "embedded", ofType: "mobileprovision")
        
        // 策略 B: 直接在 bundle 根目录查找 .mobileprovision 文件
        if profilePath == nil || !FileManager.default.fileExists(atPath: profilePath!) {
            let bundlePath = Bundle.main.bundlePath
            if let files = try? FileManager.default.contentsOfDirectory(atPath: bundlePath) {
                for file in files where file.hasSuffix(".mobileprovision") {
                    let fullPath = bundlePath + "/" + file
                    if FileManager.default.fileExists(atPath: fullPath) {
                        profilePath = fullPath
                        break
                    }
                }
            }
        }
        
        guard let finalPath = profilePath else {
            print("[AppSignature] embedded.mobileprovision not found in bundle")
            call.resolve([
                "expirationDate": NSNull(),
                "expirationTimestamp": 0,
                "daysRemaining": -1,
                "found": false
            ])
            return
        }
        
        print("[AppSignature] Found profile at: \(finalPath)")

        // 2. 读取文件内容（先尝试 UTF-8，再尝试 ASCII）
        guard let profileData = try? Data(contentsOf: URL(fileURLWithPath: finalPath)) else {
            print("[AppSignature] Failed to read profile data")
            call.resolve([
                "expirationDate": NSNull(),
                "expirationTimestamp": 0,
                "daysRemaining": -1,
                "found": true
            ])
            return
        }
        
        var profileString: String?
        profileString = String(data: profileData, encoding: .utf8)
        if profileString == nil {
            profileString = String(data: profileData, encoding: .ascii)
        }
        
        guard let profileStr = profileString else {
            print("[AppSignature] Failed to decode profile (neither UTF-8 nor ASCII)")
            call.resolve([
                "expirationDate": NSNull(),
                "expirationTimestamp": 0,
                "daysRemaining": -1,
                "found": true
            ])
            return
        }
        
        print("[AppSignature] Profile size: \(profileData.count) bytes")

        // 3. 从 CMS 签名数据中提取 plist（位于 <?xml ... </plist> 之间）
        guard let plistStart = profileStr.range(of: "<?xml"),
              let plistEnd = profileStr.range(of: "</plist>", options: .backwards) else {
            call.resolve([
                "expirationDate": NSNull(),
                "expirationTimestamp": 0,
                "daysRemaining": -1,
                "found": true
            ])
            return
        }

        let plistString = String(profileStr[plistStart.lowerBound..<plistEnd.upperBound])
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
