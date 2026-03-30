import shutil
import os

print('Creating Zip archive...')
src_dir = 'RibbonBridge_Dist'
zip_name = 'RibbonBridge_15_6_Final' 

# make_archive appends .zip automatically
# so the created file will be RibbonBridge_15_6_Final.zip
shutil.make_archive(zip_name, 'zip', src_dir)

print(f'Archive created: {zip_name}.zip')
print(f'Size: {os.path.getsize(f"{zip_name}.zip")} bytes')
