"""Generate a dependency-free Xcode project; the output is committed for Xcode Cloud."""
from pathlib import Path
import hashlib, json
root = Path(__file__).resolve().parents[1]
project = root / 'Seniorgram.xcodeproj'
(project / 'xcshareddata/xcschemes').mkdir(parents=True, exist_ok=True)
def ident(name): return hashlib.sha1(('seniorgram:' + name).encode()).hexdigest()[:24].upper()
def quote(value): return json.dumps(str(value), ensure_ascii=False)
objects = []
def obj(name, body):
    key = ident(name); objects.append(f'\t\t{key} = {{ {body} }};'); return key
app_sources = sorted((root / 'Seniorgram/Sources').glob('*.swift'))
unit_sources = sorted((root / 'SeniorgramTests').glob('*.swift'))
ui_sources = sorted((root / 'SeniorgramUITests').glob('*.swift'))
refs = {}
for path in app_sources + unit_sources + ui_sources:
    rel = path.relative_to(root).as_posix()
    refs[rel] = obj('file:' + rel, f'isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {quote(rel)}; sourceTree = SOURCE_ROOT;')
for rel, kind in [('Seniorgram/Info.plist','text.plist.xml'),('Seniorgram/Resources/PrivacyInfo.xcprivacy','text.xml'),('Seniorgram/Resources/Assets.xcassets','folder.assetcatalog')]:
    refs[rel] = obj('file:' + rel, f'isa = PBXFileReference; lastKnownFileType = {kind}; path = {quote(rel)}; sourceTree = SOURCE_ROOT;')
products = {}
for name, ext, kind in [('Seniorgram','app','wrapper.application'),('SeniorgramTests','xctest','wrapper.cfbundle'),('SeniorgramUITests','xctest','wrapper.cfbundle')]:
    products[name] = obj('product:' + name, f'isa = PBXFileReference; explicitFileType = {kind}; includeInIndex = 0; path = {name}.{ext}; sourceTree = BUILT_PRODUCTS_DIR;')
def group(name, entries): return obj('group:' + name, f'isa = PBXGroup; children = ({",".join(entries)},); name = {quote(name)}; sourceTree = "<group>";')
source_group = group('App sources',[refs[p.relative_to(root).as_posix()] for p in app_sources])
resource_group = group('Resources',[refs[p] for p in refs if p.startswith('Seniorgram/') and p not in [x.relative_to(root).as_posix() for x in app_sources]])
unit_group = group('Unit tests',[refs[p.relative_to(root).as_posix()] for p in unit_sources])
ui_group = group('UI tests',[refs[p.relative_to(root).as_posix()] for p in ui_sources])
product_group = group('Products',list(products.values()))
main_group = group('Main',[source_group,resource_group,unit_group,ui_group,product_group])
project_common = {'ALWAYS_SEARCH_USER_PATHS':'NO','CLANG_ENABLE_MODULES':'YES','CLANG_ENABLE_OBJC_ARC':'YES','IPHONEOS_DEPLOYMENT_TARGET':'17.0','SDKROOT':'iphoneos','SWIFT_VERSION':'5.0','SWIFT_STRICT_CONCURRENCY':'minimal','ENABLE_USER_SCRIPT_SANDBOXING':'YES'}
def settings(data): return ' '.join(f'{k} = {quote(v)};' for k,v in data.items())
def configs(name, common):
    keys = []
    for mode in ['Debug','Release']:
        values = common.copy()
        values.update({'SWIFT_OPTIMIZATION_LEVEL':'-Onone' if mode == 'Debug' else '-O','DEBUG_INFORMATION_FORMAT':'dwarf' if mode == 'Debug' else 'dwarf-with-dsym'})
        if mode == 'Debug': values['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = 'DEBUG'
        keys.append(obj('config:' + name + ':' + mode, f'isa = XCBuildConfiguration; buildSettings = {{{settings(values)}}}; name = {mode};'))
    return obj('config-list:' + name, f'isa = XCConfigurationList; buildConfigurations = ({",".join(keys)},); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
project_configs = configs('project',project_common)
app_settings = {'PRODUCT_BUNDLE_IDENTIFIER':'app.jininova.seniorgram','PRODUCT_NAME':'$(TARGET_NAME)','INFOPLIST_FILE':'Seniorgram/Info.plist','GENERATE_INFOPLIST_FILE':'NO','DEVELOPMENT_TEAM':'5H4Z8667H6','CODE_SIGN_STYLE':'Automatic','CURRENT_PROJECT_VERSION':'1','MARKETING_VERSION':'1.0.0','TARGETED_DEVICE_FAMILY':'1','SUPPORTED_PLATFORMS':'iphoneos iphonesimulator','SUPPORTS_MACCATALYST':'NO','SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD':'NO','ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks','ENABLE_PREVIEWS':'YES'}
for name, source_list, product_type in [('Seniorgram',app_sources,'com.apple.product-type.application'),('SeniorgramTests',unit_sources,'com.apple.product-type.bundle.unit-test'),('SeniorgramUITests',ui_sources,'com.apple.product-type.bundle.ui-testing')]:
    source_builds = []
    for path in source_list:
        rel = path.relative_to(root).as_posix()
        source_builds.append(obj('build:' + rel, f'isa = PBXBuildFile; fileRef = {refs[rel]};'))
    source_phase = obj('sources:' + name, f'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({",".join(source_builds)},); runOnlyForDeploymentPostprocessing = 0;')
    framework_phase = obj('frameworks:' + name, 'isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
    resources = []
    if name == 'Seniorgram':
        for rel in ['Seniorgram/Resources/Assets.xcassets','Seniorgram/Resources/PrivacyInfo.xcprivacy']:
            resources.append(obj('build:' + rel, f'isa = PBXBuildFile; fileRef = {refs[rel]};'))
    resource_phase = obj('resources:' + name, f'isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({",".join(resources)}); runOnlyForDeploymentPostprocessing = 0;')
    dependencies = []
    if name != 'Seniorgram':
        proxy = obj('proxy:' + name, f'isa = PBXContainerItemProxy; containerPortal = {ident("project")}; proxyType = 1; remoteGlobalIDString = {ident("target:Seniorgram")}; remoteInfo = Seniorgram;')
        dependencies.append(obj('dependency:' + name, f'isa = PBXTargetDependency; target = {ident("target:Seniorgram")}; targetProxy = {proxy};'))
        target_settings = {'PRODUCT_NAME':'$(TARGET_NAME)','PRODUCT_BUNDLE_IDENTIFIER':'app.jininova.seniorgram.' + ('tests' if name.endswith('Tests') and 'UI' not in name else 'uitests'),'GENERATE_INFOPLIST_FILE':'YES','TARGETED_DEVICE_FAMILY':'1','DEVELOPMENT_TEAM':'5H4Z8667H6','CODE_SIGN_STYLE':'Automatic'}
        if name == 'SeniorgramTests': target_settings.update({'TEST_HOST':'$(BUILT_PRODUCTS_DIR)/Seniorgram.app/Seniorgram','BUNDLE_LOADER':'$(TEST_HOST)'})
        else: target_settings['TEST_TARGET_NAME'] = 'Seniorgram'
    else: target_settings = app_settings
    cfg = configs(name,target_settings)
    obj('target:' + name, f'isa = PBXNativeTarget; buildConfigurationList = {cfg}; buildPhases = ({source_phase},{framework_phase},{resource_phase},); buildRules = (); dependencies = ({",".join(dependencies)}); name = {name}; productName = {name}; productReference = {products[name]}; productType = {quote(product_type)};')
obj('project', f'isa = PBXProject; attributes = {{ BuildIndependentTargetsInParallel = YES; LastUpgradeCheck = 2600; TargetAttributes = {{ {ident("target:Seniorgram")} = {{ CreatedOnToolsVersion = 26.0; }}; {ident("target:SeniorgramTests")} = {{ CreatedOnToolsVersion = 26.0; TestTargetID = {ident("target:Seniorgram")}; }}; {ident("target:SeniorgramUITests")} = {{ CreatedOnToolsVersion = 26.0; TestTargetID = {ident("target:Seniorgram")}; }}; }}; }}; buildConfigurationList = {project_configs}; compatibilityVersion = "Xcode 14.0"; developmentRegion = ko; hasScannedForEncodings = 0; knownRegions = (ko,en,Base,); mainGroup = {main_group}; productRefGroup = {product_group}; projectDirPath = ""; projectRoot = ""; targets = ({ident("target:Seniorgram")},{ident("target:SeniorgramTests")},{ident("target:SeniorgramUITests")},);')
(project / 'project.pbxproj').write_text('// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {};\n\tobjectVersion = 56;\n\tobjects = {\n' + '\n'.join(objects) + '\n\t};\n\trootObject = ' + ident('project') + ';\n}\n')
def ref(name, ext): return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{ident("target:" + name)}" BuildableName="{name}.{ext}" BlueprintName="{name}" ReferencedContainer="container:Seniorgram.xcodeproj"/>'
scheme = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.7">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{ref('Seniorgram','app')}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO" parallelizable="NO">{ref('SeniorgramTests','xctest')}</TestableReference><TestableReference skipped="NO" parallelizable="NO">{ref('SeniorgramUITests','xctest')}</TestableReference></Testables></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref('Seniorgram','app')}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref('Seniorgram','app')}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>'''
(project / 'xcshareddata/xcschemes/Seniorgram.xcscheme').write_text(scheme)
print('Generated',project)
